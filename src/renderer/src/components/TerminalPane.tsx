import { useEffect, useRef, useState } from 'react'
import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css'

const SESSION_ID = 'phase-1-shell'

type TerminalStatus = 'starting' | 'running' | 'exited' | 'error'

function getStatusLabel(status: TerminalStatus): string {
  if (status === 'starting') return 'starting'
  if (status === 'running') return 'running'
  if (status === 'exited') return 'exited'
  return 'error'
}

export function TerminalPane(): React.JSX.Element {
  const terminalContainerRef = useRef<HTMLDivElement | null>(null)
  const [status, setStatus] = useState<TerminalStatus>('starting')
  const [metadata, setMetadata] = useState('local shell')

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

    terminal.loadAddon(fitAddon)
    terminal.open(terminalContainer)
    terminal.focus()

    const resize = (): void => {
      if (disposed) return

      fitAddon.fit()
      window.api.terminal.resize({
        id: SESSION_ID,
        cols: terminal.cols,
        rows: terminal.rows
      })
    }

    const inputDisposable = terminal.onData((data) => {
      window.api.terminal.write({ id: SESSION_ID, data })
    })

    const offData = window.api.terminal.onData((event) => {
      if (event.id === SESSION_ID) {
        terminal.write(event.data)
      }
    })

    const offExit = window.api.terminal.onExit((event) => {
      if (event.id !== SESSION_ID) return

      setStatus('exited')
      terminal.writeln('')
      terminal.writeln(`[process exited with code ${event.exitCode}]`)
    })

    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(terminalContainer)

    animationFrame = window.requestAnimationFrame(() => {
      resize()
      window.api.terminal
        .start({
          id: SESSION_ID,
          cols: terminal.cols,
          rows: terminal.rows
        })
        .then((response) => {
          if (disposed) return

          setMetadata(`${response.shell} - pid ${response.pid}`)
          setStatus('running')
        })
        .catch((error: unknown) => {
          if (disposed) return

          setStatus('error')
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
      void window.api.terminal.stop(SESSION_ID)
      terminal.dispose()
    }
  }, [])

  return (
    <div className="terminal-frame" aria-label="Terminal">
      <div className="terminal-toolbar">
        <div className="terminal-controls" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="terminal-meta">
          <span>{metadata}</span>
          <strong className={`terminal-status terminal-status--${status}`}>
            {getStatusLabel(status)}
          </strong>
        </div>
      </div>
      <div ref={terminalContainerRef} className="terminal-surface" />
    </div>
  )
}
