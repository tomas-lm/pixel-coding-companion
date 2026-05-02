import { useEffect } from 'react'

type MarkSessionExited = (sessionId: string, exitCode: number, exitSignal?: number) => void

export function useTerminalEvents(markSessionExited: MarkSessionExited): void {
  useEffect(() => {
    const offCommandExit = window.api.terminal.onCommandExit((event) => {
      markSessionExited(event.id, event.exitCode)
    })
    const offExit = window.api.terminal.onExit((event) => {
      markSessionExited(event.id, event.exitCode, event.signal)
    })

    return () => {
      offCommandExit()
      offExit()
    }
  }, [markSessionExited])
}
