import { useEffect } from 'react'

type MarkSessionExited = (sessionId: string, exitCode: number, exitSignal?: number) => void
type MarkCommandExited = (sessionId: string, exitCode: number) => void

export function useTerminalEvents(
  markSessionExited: MarkSessionExited,
  markCommandExited?: MarkCommandExited
): void {
  useEffect(() => {
    const offCommandExit = window.api.terminal.onCommandExit((event) => {
      markSessionExited(event.id, event.exitCode)
      markCommandExited?.(event.id, event.exitCode)
    })
    const offExit = window.api.terminal.onExit((event) => {
      markSessionExited(event.id, event.exitCode, event.signal)
    })

    return () => {
      offCommandExit()
      offExit()
    }
  }, [markCommandExited, markSessionExited])
}
