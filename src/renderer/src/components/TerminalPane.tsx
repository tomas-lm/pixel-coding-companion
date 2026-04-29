import { useEffect, useRef } from 'react'
import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'
import type { RunningSession, RunningSessionStatus } from '../../../shared/workspace'
import '@xterm/xterm/css/xterm.css'

type TerminalPaneProps = {
  session: RunningSession
  isActive: boolean
  onSessionActivity: (sessionId: string, output: string) => void
  onSessionExit: (sessionId: string, exitCode: number, signal?: number) => void
  onSessionStartError: (sessionId: string, errorMessage: string) => void
  onSessionStarted: (sessionId: string, metadata: string) => void
}

function getStatusLabel(status: RunningSessionStatus): string {
  if (status === 'starting') return 'starting'
  if (status === 'running') return 'running'
  if (status === 'done') return 'done'
  return 'error'
}

export function TerminalPane({
  session,
  isActive,
  onSessionActivity,
  onSessionExit,
  onSessionStartError,
  onSessionStarted
}: TerminalPaneProps): React.JSX.Element {
  const terminalContainerRef = useRef<HTMLDivElement | null>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)

  useEffect(() => {
    if (!isActive) return

    terminalRef.current?.focus()
    fitAddonRef.current?.fit()

    const terminal = terminalRef.current
    if (terminal) {
      window.api.terminal.resize({
        id: session.id,
        cols: terminal.cols,
        rows: terminal.rows
      })
    }
  }, [isActive, session.id])

  useEffect(() => {
    const terminalContainer = terminalContainerRef.current
    if (!terminalContainer) return

    const terminal = new Terminal({
      allowProposedApi: false,
      convertEol: true,
      cursorBlink: true,
      fontFamily: 'Menlo, Monaco, Consolas, "Liberation Mono", monospace',
      fontSize: 13,
      lineHeight: 1.25,
      scrollback: 5000,
      theme: {
        background: '#0d1117',
        cursor: '#7fe7dc',
        foreground: '#d1f7d6',
        selectionBackground: '#284b63'
      }
    })
    const fitAddon = new FitAddon()
    let disposed = false
    let animationFrame = 0

    terminalRef.current = terminal
    fitAddonRef.current = fitAddon
    terminal.loadAddon(fitAddon)
    terminal.open(terminalContainer)

    const resize = (): void => {
      if (disposed) return

      fitAddon.fit()
      window.api.terminal.resize({
        id: session.id,
        cols: terminal.cols,
        rows: terminal.rows
      })
    }

    const inputDisposable = terminal.onData((data) => {
      window.api.terminal.write({ id: session.id, data })
    })

    let lastActivityUpdate = 0

    const offData = window.api.terminal.onData((event) => {
      if (event.id === session.id) {
        terminal.write(event.data)

        const now = Date.now()
        if (event.data.trim() && (now - lastActivityUpdate > 1000 || event.data.includes('\n'))) {
          lastActivityUpdate = now
          onSessionActivity(session.id, event.data)
        }
      }
    })

    const offCommandExit = window.api.terminal.onCommandExit((event) => {
      if (event.id !== session.id) return

      onSessionExit(session.id, event.exitCode)
      terminal.writeln('')
      terminal.writeln(
        `[command ${event.exitCode === 0 ? 'completed' : 'failed'} with code ${event.exitCode}]`
      )
    })

    const offExit = window.api.terminal.onExit((event) => {
      if (event.id !== session.id) return

      onSessionExit(session.id, event.exitCode, event.signal)
      terminal.writeln('')
      terminal.writeln(`[process exited with code ${event.exitCode}]`)
    })

    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(terminalContainer)

    animationFrame = window.requestAnimationFrame(() => {
      resize()
      window.api.terminal
        .start({
          id: session.id,
          autoLaunchInput: session.autoLaunchInstruction,
          companionContext: {
            cwd: session.cwd,
            projectColor: session.projectColor,
            projectId: session.projectId,
            projectName: session.projectName,
            sessionId: session.id,
            terminalId: session.configId,
            terminalName: session.name
          },
          cols: terminal.cols,
          rows: terminal.rows,
          cwd: session.cwd || undefined,
          commands: session.commands,
          suppressCommandExitMarker: Boolean(session.autoLaunchInstruction),
          env: {
            PIXEL_COMPANION_CWD: session.cwd,
            PIXEL_COMPANION_PROJECT_COLOR: session.projectColor,
            PIXEL_COMPANION_PROJECT_ID: session.projectId,
            PIXEL_COMPANION_PROJECT_NAME: session.projectName,
            PIXEL_COMPANION_SESSION_ID: session.id,
            PIXEL_COMPANION_TERMINAL_ID: session.configId,
            PIXEL_COMPANION_TERMINAL_NAME: session.name
          }
        })
        .then((response) => {
          if (disposed) return

          onSessionStarted(session.id, `${response.shell} - pid ${response.pid}`)
        })
        .catch((error: unknown) => {
          if (disposed) return

          const errorMessage = String(error)
          onSessionStartError(session.id, errorMessage)
          terminal.writeln(`Failed to start terminal: ${errorMessage}`)
        })
    })

    return () => {
      disposed = true
      window.cancelAnimationFrame(animationFrame)
      resizeObserver.disconnect()
      inputDisposable.dispose()
      offData()
      offCommandExit()
      offExit()
      void window.api.terminal.stop(session.id)
      terminal.dispose()
      terminalRef.current = null
      fitAddonRef.current = null
    }
  }, [
    onSessionActivity,
    onSessionExit,
    onSessionStartError,
    onSessionStarted,
    session.autoLaunchInstruction,
    session.commands,
    session.configId,
    session.cwd,
    session.id,
    session.name,
    session.projectColor,
    session.projectId,
    session.projectName
  ])

  return (
    <div className="terminal-frame" aria-label={`${session.name} terminal`}>
      <div className="terminal-toolbar">
        <div className="terminal-controls" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="terminal-meta">
          <span>{session.metadata}</span>
          <strong className={`terminal-status terminal-status--${session.status}`}>
            {getStatusLabel(session.status)}
          </strong>
        </div>
      </div>
      <div ref={terminalContainerRef} className="terminal-surface" />
    </div>
  )
}
