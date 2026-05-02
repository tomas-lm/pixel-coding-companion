import { useCallback, useEffect, useRef, useState } from 'react'
import type { TerminalConfig } from '../../../shared/workspace'
import { getTerminalCommandDetail } from '../app/sessionDisplay'

const TERMINAL_HOVER_CARD_DELAY_MS = 500

export type TerminalHoverCard = {
  description: string
  left: number
  path: string
  title: string
  top: number
}

type UseTerminalHoverCardResult = {
  clearTerminalHoverCard: () => void
  scheduleTerminalHoverCard: (config: TerminalConfig, target: HTMLElement) => void
  terminalHoverCard: TerminalHoverCard | null
}

export function useTerminalHoverCard(): UseTerminalHoverCardResult {
  const [terminalHoverCard, setTerminalHoverCard] = useState<TerminalHoverCard | null>(null)
  const terminalHoverCardTimeoutRef = useRef<number | null>(null)

  const clearTerminalHoverCard = useCallback((): void => {
    if (terminalHoverCardTimeoutRef.current !== null) {
      window.clearTimeout(terminalHoverCardTimeoutRef.current)
      terminalHoverCardTimeoutRef.current = null
    }

    setTerminalHoverCard(null)
  }, [])

  useEffect(() => {
    return () => {
      if (terminalHoverCardTimeoutRef.current !== null) {
        window.clearTimeout(terminalHoverCardTimeoutRef.current)
      }
    }
  }, [])

  const scheduleTerminalHoverCard = useCallback(
    (config: TerminalConfig, target: HTMLElement): void => {
      if (terminalHoverCardTimeoutRef.current !== null) {
        window.clearTimeout(terminalHoverCardTimeoutRef.current)
      }

      const rect = target.getBoundingClientRect()
      const cardWidth = 360
      const maxLeft = Math.max(12, window.innerWidth - cardWidth - 12)
      const left = Math.min(Math.max(rect.left, 12), maxLeft)
      const top = Math.max(12, Math.min(rect.bottom + 8, window.innerHeight - 132))

      terminalHoverCardTimeoutRef.current = window.setTimeout(() => {
        terminalHoverCardTimeoutRef.current = null
        setTerminalHoverCard({
          title: config.name,
          description: getTerminalCommandDetail(config),
          path: config.cwd || 'home folder',
          left,
          top
        })
      }, TERMINAL_HOVER_CARD_DELAY_MS)
    },
    []
  )

  return {
    clearTerminalHoverCard,
    scheduleTerminalHoverCard,
    terminalHoverCard
  }
}
