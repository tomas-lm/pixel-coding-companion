import * as pty from 'node-pty'
import { basename } from 'path'
import {
  TERMINAL_CHANNELS,
  type TerminalInputRequest,
  type TerminalResizeRequest,
  type TerminalSessionId,
  type TerminalStartRequest,
  type TerminalStartResponse
} from '../../shared/terminal'
import { wrapCommandWithPixel, type PixelCliCommandPaths } from './pixelCommand'
import type { TerminalContextRegistry } from './terminalContextRegistry'
import {
  COMMAND_EXIT_COMMAND,
  COMMAND_EXIT_PATTERN,
  appendTerminalOutputBuffer,
  getMarkerPrefixLength,
  isCodexCliReady,
  stripBenignMacOsMallocStackLogging
} from './terminalOutput'
import { shouldTrackCodexContext, type CodexContextTelemetryService } from './codexContextTelemetry'

type PtyProcess = ReturnType<typeof pty.spawn>

type ManagedTerminal = {
  autoLaunchInput?: string
  autoLaunchInputSent: boolean
  cwd: string
  outputBuffer: string
  pendingData: string
  pid: number
  process: PtyProcess | null
  sessionId: TerminalSessionId
  shell: string
  stableKey?: string
}

export type TerminalManagerDependencies = {
  broadcastTerminalEvent: (channel: string, data: unknown) => void
  codexContextTelemetry: CodexContextTelemetryService
  contextRegistry: TerminalContextRegistry
  getDefaultShell: () => string
  getPixelCliCommandPaths: () => PixelCliCommandPaths
  getPtyEnv: (extraEnv?: Record<string, string>) => Promise<Record<string, string>>
  getSafeCwd: (cwd?: string) => string
}

const AUTO_LAUNCH_FALLBACK_DELAY_MS = 7000
const AUTO_LAUNCH_SUBMIT_DELAY_MS = 180

export function getPtyShellArgs(
  shellPath: string,
  platform: NodeJS.Platform = process.platform
): string[] {
  // GUI/Electron apps (including AppImage) often inherit a minimal PATH. Login shells load the
  // same profile chain as a normal terminal on Unix — macOS already relied on this; Linux needs
  // it too so ~/.profile / ~/.zprofile (and Go/rustup PATH hooks) apply inside Pixel's PTY.
  if (platform === 'win32') return []

  const shellName = basename(shellPath)
  return shellName === 'zsh' || shellName === 'bash' ? ['--login'] : []
}

export class TerminalManager {
  private readonly terminals = new Map<TerminalSessionId, ManagedTerminal>()

  constructor(private readonly dependencies: TerminalManagerDependencies) {}

  async start(request: TerminalStartRequest): Promise<TerminalStartResponse> {
    const existingTerminal = this.findTerminalForStartRequest(request)
    if (existingTerminal) {
      existingTerminal.sessionId = request.id
      this.terminals.set(request.id, existingTerminal)

      if (existingTerminal.process) {
        existingTerminal.process.resize(Math.max(request.cols, 2), Math.max(request.rows, 2))
        await this.dependencies.contextRegistry.registerProcess(
          request.id,
          existingTerminal.pid,
          request.companionContext
        )
      }

      return {
        id: request.id,
        pid: existingTerminal.pid,
        shell: existingTerminal.shell,
        cwd: existingTerminal.cwd,
        attached: true,
        initialBuffer: existingTerminal.outputBuffer || undefined
      }
    }

    const shellPath = this.dependencies.getDefaultShell()
    const cwd = this.dependencies.getSafeCwd(request.cwd)
    const stableKey = this.getTerminalStableKey(request)
    const startedAtMs = Date.now()
    const contextEnv = await this.dependencies.contextRegistry.writeCompanionContext(
      request.id,
      request.companionContext
    )
    const terminal = pty.spawn(shellPath, getPtyShellArgs(shellPath), {
      name: 'xterm-256color',
      cols: Math.max(request.cols, 2),
      rows: Math.max(request.rows, 2),
      cwd,
      env: await this.dependencies.getPtyEnv({
        ...(request.env ?? {}),
        ...contextEnv
      })
    })
    await this.dependencies.contextRegistry.registerProcess(
      request.id,
      terminal.pid,
      request.companionContext
    )
    if (shouldTrackCodexContext(request)) {
      this.dependencies.codexContextTelemetry.trackTerminal({
        cwd,
        sessionId: request.id,
        startedAtMs
      })
    }

    this.terminals.set(request.id, {
      autoLaunchInput: request.autoLaunchInput?.trim() || undefined,
      autoLaunchInputSent: false,
      cwd,
      outputBuffer: '',
      pendingData: '',
      pid: terminal.pid,
      process: terminal,
      sessionId: request.id,
      shell: shellPath,
      stableKey
    })

    terminal.onData((data) => {
      const managedTerminal = this.terminals.get(request.id)
      if (!managedTerminal || managedTerminal.process !== terminal) return

      const combinedData = managedTerminal.pendingData + data
      let visibleData = ''
      let lastIndex = 0

      for (const match of combinedData.matchAll(COMMAND_EXIT_PATTERN)) {
        visibleData += combinedData.slice(lastIndex, match.index)
        lastIndex = match.index + match[0].length

        this.dependencies.broadcastTerminalEvent(TERMINAL_CHANNELS.commandExit, {
          id: managedTerminal.sessionId,
          exitCode: Number(match[1])
        })
      }

      visibleData += combinedData.slice(lastIndex)
      visibleData = visibleData.replaceAll(COMMAND_EXIT_COMMAND, '')
      visibleData = stripBenignMacOsMallocStackLogging(visibleData)

      const pendingLength = getMarkerPrefixLength(visibleData)
      managedTerminal.pendingData = pendingLength > 0 ? visibleData.slice(-pendingLength) : ''
      visibleData = pendingLength > 0 ? visibleData.slice(0, -pendingLength) : visibleData

      this.writeAutoLaunchInputIfCodexReady(terminal, request.id, visibleData)
      managedTerminal.outputBuffer = appendTerminalOutputBuffer(
        managedTerminal.outputBuffer,
        visibleData
      )

      this.dependencies.broadcastTerminalEvent(TERMINAL_CHANNELS.data, {
        id: managedTerminal.sessionId,
        data: visibleData
      })
    })

    terminal.onExit(({ exitCode, signal }) => {
      const managedTerminal = this.terminals.get(request.id)
      const sessionId = managedTerminal?.sessionId ?? request.id
      if (managedTerminal?.process === terminal) {
        managedTerminal.process = null
        managedTerminal.pendingData = ''
      }

      this.dependencies.codexContextTelemetry.stopTerminal(sessionId)
      void this.dependencies.contextRegistry.unregisterProcess(request.id)
      this.dependencies.broadcastTerminalEvent(TERMINAL_CHANNELS.exit, {
        id: sessionId,
        exitCode,
        signal
      })
    })

    const commands =
      request.commands
        ?.map((command) =>
          wrapCommandWithPixel(
            command,
            request.startWithPixel,
            request.pixelAgent,
            this.dependencies.getPixelCliCommandPaths()
          )
        )
        .filter(Boolean) ?? []
    if (commands.length > 0) {
      this.writeStartupCommands(terminal, request.id, commands, {
        writeExitMarker: !request.suppressCommandExitMarker
      })
    }

    if (request.autoLaunchInput) {
      this.scheduleAutoLaunchInputFallback(terminal, request.id, commands.length)
    }

    return {
      id: request.id,
      pid: terminal.pid,
      shell: shellPath,
      cwd,
      attached: false
    }
  }

  stop(id: TerminalSessionId): void {
    const managedTerminal = this.terminals.get(id)
    if (!managedTerminal) return

    for (const [terminalId, candidate] of this.terminals) {
      if (candidate === managedTerminal) {
        this.terminals.delete(terminalId)
        void this.dependencies.contextRegistry.unregisterProcess(terminalId)
        this.dependencies.codexContextTelemetry.stopTerminal(terminalId)
      }
    }

    managedTerminal.process?.kill()
  }

  stopAll(): void {
    for (const id of this.terminals.keys()) {
      this.stop(id)
    }
    this.dependencies.codexContextTelemetry.stopAll()
  }

  writeInput(request: TerminalInputRequest): void {
    this.terminals.get(request.id)?.process?.write(request.data)
  }

  resize(request: TerminalResizeRequest): void {
    const managedTerminal = this.terminals.get(request.id)
    if (!managedTerminal) return

    managedTerminal.process?.resize(Math.max(request.cols, 2), Math.max(request.rows, 2))
  }

  private getTerminalStableKey(request: TerminalStartRequest): string | undefined {
    const context = request.companionContext
    if (!context?.projectId || !context.terminalId) return undefined

    return `${context.projectId}:${context.terminalId}`
  }

  private findTerminalForStartRequest(request: TerminalStartRequest): ManagedTerminal | undefined {
    const existingBySessionId = this.terminals.get(request.id)
    if (existingBySessionId) return existingBySessionId

    const stableKey = this.getTerminalStableKey(request)
    if (!stableKey) return undefined

    for (const terminal of new Set(this.terminals.values())) {
      if (terminal.stableKey === stableKey && terminal.process) {
        return terminal
      }
    }

    return undefined
  }

  private writeStartupCommands(
    terminal: PtyProcess,
    id: TerminalSessionId,
    commands: string[],
    options: { writeExitMarker: boolean }
  ): void {
    commands.forEach((command, index) => {
      setTimeout(() => {
        if (this.terminals.get(id)?.process === terminal) {
          terminal.write(`${command}\r`)
        }
      }, index * 80)
    })

    if (!options.writeExitMarker) return

    setTimeout(() => {
      if (this.terminals.get(id)?.process === terminal) {
        terminal.write(`${COMMAND_EXIT_COMMAND}\r`)
      }
    }, commands.length * 80)
  }

  private writeAutoLaunchInput(terminal: PtyProcess, id: TerminalSessionId): void {
    const managedTerminal = this.terminals.get(id)
    if (!managedTerminal?.autoLaunchInput || managedTerminal.autoLaunchInputSent) return

    managedTerminal.autoLaunchInputSent = true
    terminal.write(managedTerminal.autoLaunchInput)

    setTimeout(() => {
      if (this.terminals.get(id)?.process === terminal) {
        terminal.write('\r')
      }
    }, AUTO_LAUNCH_SUBMIT_DELAY_MS)
  }

  private writeAutoLaunchInputIfCodexReady(
    terminal: PtyProcess,
    id: TerminalSessionId,
    output: string
  ): void {
    if (!isCodexCliReady(output)) return

    setTimeout(() => {
      if (this.terminals.get(id)?.process === terminal) {
        this.writeAutoLaunchInput(terminal, id)
      }
    }, 350)
  }

  private scheduleAutoLaunchInputFallback(
    terminal: PtyProcess,
    id: TerminalSessionId,
    commandCount: number
  ): void {
    const delayMs = commandCount * 120 + AUTO_LAUNCH_FALLBACK_DELAY_MS

    setTimeout(() => {
      if (this.terminals.get(id)?.process === terminal) {
        this.writeAutoLaunchInput(terminal, id)
      }
    }, delayMs)
  }
}
