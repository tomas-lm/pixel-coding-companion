import { useEffect, useRef } from 'react'
import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'
import type { RunningSession, RunningSessionStatus } from '../../../shared/workspace'
import '@xterm/xterm/css/xterm.css'

type TerminalPaneProps = {
  session: RunningSession
  isActive: boolean
  onMetadataChange: (sessionId: string, metadata: string) => void
  onStatusChange: (sessionId: string, status: RunningSessionStatus) => void
}

function getStatusLabel(status: RunningSessionStatus): string {
  if (status === 'starting') return 'starting'
  if (status === 'running') return 'running'
  if (status === 'exited') return 'exited'
  return 'error'
}

export function TerminalPane({
  session,
  isActive,
  onMetadataChange,
  onStatusChange
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

    const offData = window.api.terminal.onData((event) => {
      if (event.id === session.id) {
        terminal.write(event.data)
      }
    })

    const offExit = window.api.terminal.onExit((event) => {
      if (event.id !== session.id) return

      onStatusChange(session.id, 'exited')
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
          cols: terminal.cols,
          rows: terminal.rows,
          cwd: session.cwd || undefined,
          commands: session.commands
        })
        .then((response) => {
          if (disposed) return

          onMetadataChange(session.id, `${response.shell} - pid ${response.pid}`)
          onStatusChange(session.id, 'running')
        })
        .catch((error: unknown) => {
          if (disposed) return

          onStatusChange(session.id, 'error')
          terminal.writeln(`Failed to start terminal: ${String(error)}`)
        })
    })

    return () => {
      disposed = true
      window.cancelAnimationFrame(animationFrame)
      resizeObserver.disconnect()
      inputDisposable.dispose()
      offData()
      offExit()
      void window.api.terminal.stop(session.id)
      terminal.dispose()
      terminalRef.current = null
      fitAddonRef.current = null
    }
  }, [onMetadataChange, onStatusChange, session.commands, session.cwd, session.id])

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
