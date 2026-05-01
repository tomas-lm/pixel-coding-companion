import { useEffect, useRef } from 'react'
import { FitAddon } from '@xterm/addon-fit'
import { Terminal, type ILink } from '@xterm/xterm'
import type {
  RunningSession,
  RunningSessionStatus,
  TerminalThemeId
} from '../../../shared/workspace'
import { getOpenTargetRequestFromHyperlink } from '../lib/terminalHyperlinks'
import { findTerminalLinks, type TerminalLinkCandidate } from '../lib/terminalLinks'
import { handleTerminalKeyEvent } from '../lib/terminalKeyboard'
import { getTerminalTheme, getTerminalThemeStyle } from '../lib/terminalThemes'
import '@xterm/xterm/css/xterm.css'

type TerminalPaneProps = {
  session: RunningSession
  isActive: boolean
  terminalThemeId: TerminalThemeId
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

function isOpenModifier(event: MouseEvent): boolean {
  return navigator.platform.toLowerCase().includes('mac') ? event.metaKey : event.ctrlKey
}

function stopTerminalMouseEvent(event: MouseEvent): void {
  event.preventDefault()
  event.stopPropagation()
  event.stopImmediatePropagation()
}

export function TerminalPane({
  session,
  isActive,
  terminalThemeId,
  onSessionActivity,
  onSessionExit,
  onSessionStartError,
  onSessionStarted
}: TerminalPaneProps): React.JSX.Element {
  const terminalContainerRef = useRef<HTMLDivElement | null>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const initialTerminalThemeIdRef = useRef(terminalThemeId)

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
      linkHandler: {
        allowNonHttpProtocols: true,
        activate: (event, text) => {
          if (!isOpenModifier(event)) return

          const request = getOpenTargetRequestFromHyperlink(text, session.cwd)
          if (!request) return

          event.preventDefault()
          void window.api.system.openTarget(request)
        }
      },
      theme: getTerminalTheme(initialTerminalThemeIdRef.current)
    })
    const fitAddon = new FitAddon()
    let disposed = false
    let animationFrame = 0

    terminalRef.current = terminal
    fitAddonRef.current = fitAddon
    terminal.loadAddon(fitAddon)
    terminal.open(terminalContainer)
    terminal.attachCustomKeyEventHandler((event) =>
      handleTerminalKeyEvent(event, (data) => {
        window.api.terminal.write({ id: session.id, data })
      })
    )

    let hoveredFallbackLink: TerminalLinkCandidate | null = null

    const handleModifierMouseDown = (event: MouseEvent): void => {
      if (!isOpenModifier(event)) return
      if (!hoveredFallbackLink) return

      stopTerminalMouseEvent(event)
      void window.api.system.openTarget(hoveredFallbackLink.request)
    }

    terminalContainer.addEventListener('mousedown', handleModifierMouseDown, { capture: true })

    const linkProviderDisposable = terminal.registerLinkProvider({
      provideLinks: (bufferLineNumber, callback) => {
        const bufferLine =
          terminal.buffer.active.getLine(bufferLineNumber - 1) ??
          terminal.buffer.active.getLine(bufferLineNumber)
        const lineText = bufferLine?.translateToString(true)
        if (!lineText) {
          callback(undefined)
          return
        }

        const links: ILink[] = findTerminalLinks(lineText, session.cwd).map((candidate) => ({
          text: candidate.text,
          range: {
            start: {
              x: candidate.startIndex + 1,
              y: bufferLineNumber
            },
            end: {
              x: candidate.endIndex,
              y: bufferLineNumber
            }
          },
          activate: (event) => {
            if (!isOpenModifier(event)) return

            event.preventDefault()
            void window.api.system.openTarget(candidate.request)
          },
          hover: () => {
            hoveredFallbackLink = candidate
          },
          leave: () => {
            if (hoveredFallbackLink === candidate) {
              hoveredFallbackLink = null
            }
          },
          dispose: () => {
            if (hoveredFallbackLink === candidate) {
              hoveredFallbackLink = null
            }
          }
        }))

        callback(links.length > 0 ? links : undefined)
      }
    })

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
          startWithPixel: session.startWithPixel,
          suppressCommandExitMarker: Boolean(
            session.autoLaunchInstruction || session.startWithPixel
          ),
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
      terminalContainer.removeEventListener('mousedown', handleModifierMouseDown, { capture: true })
      inputDisposable.dispose()
      linkProviderDisposable.dispose()
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
    session.projectName,
    session.startWithPixel
  ])

  useEffect(() => {
    const terminal = terminalRef.current
    if (!terminal) return

    terminal.options.theme = getTerminalTheme(terminalThemeId)
  }, [terminalThemeId])

  return (
    <div
      className="terminal-frame"
      style={getTerminalThemeStyle(terminalThemeId)}
      aria-label={`${session.name} terminal`}
    >
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
