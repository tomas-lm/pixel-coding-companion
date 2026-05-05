import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import type { TerminalThemeId, WorkspaceLayout } from '../../../shared/workspace'
import {
  DEFAULT_LAYOUT,
  normalizeLayout,
  normalizeTerminalThemeId,
  type LayoutResizeTarget
} from '../app/layout'

type UseWorkspaceLayoutResult = {
  applyTerminalTheme: (themeId?: unknown) => TerminalThemeId
  layout: WorkspaceLayout
  setLayout: Dispatch<SetStateAction<WorkspaceLayout>>
  startLayoutResize: (
    event: React.PointerEvent<HTMLButtonElement>,
    target: LayoutResizeTarget
  ) => void
  terminalThemeId: TerminalThemeId
}

export function useWorkspaceLayout(): UseWorkspaceLayoutResult {
  const [layout, setLayout] = useState<WorkspaceLayout>(DEFAULT_LAYOUT)
  const [terminalThemeId, setTerminalThemeId] = useState<TerminalThemeId>(
    normalizeTerminalThemeId()
  )

  const applyTerminalTheme = useCallback((themeId?: unknown): TerminalThemeId => {
    const normalizedThemeId = normalizeTerminalThemeId(themeId)

    setTerminalThemeId(normalizedThemeId)

    return normalizedThemeId
  }, [])

  useEffect(() => {
    return window.api.view.onResetLayout(() => {
      setLayout(DEFAULT_LAYOUT)
    })
  }, [])

  const startLayoutResize = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>, target: LayoutResizeTarget): void => {
      event.preventDefault()

      const startX = event.clientX
      const startY = event.clientY
      const startLayout = layout
      const resizeClass = target === 'railWidth' || target === 'companionWidth' ? 'column' : 'row'

      document.body.classList.add('is-resizing', `is-resizing--${resizeClass}`)

      const updateLayout = (moveEvent: PointerEvent): void => {
        const deltaX = moveEvent.clientX - startX
        const deltaY = moveEvent.clientY - startY
        const nextLayout = { ...startLayout }

        if (target === 'railWidth') {
          nextLayout.railWidth = startLayout.railWidth + deltaX
        } else if (target === 'companionWidth') {
          nextLayout.companionWidth = startLayout.companionWidth - deltaX
        } else if (target === 'projectsHeight') {
          nextLayout.projectsHeight = startLayout.projectsHeight + deltaY
        } else {
          nextLayout.terminalsHeight = startLayout.terminalsHeight + deltaY
        }

        setLayout(normalizeLayout(nextLayout))
      }

      const stopResize = (): void => {
        document.body.classList.remove('is-resizing', `is-resizing--${resizeClass}`)
        window.removeEventListener('pointermove', updateLayout)
        window.removeEventListener('pointerup', stopResize)
        window.removeEventListener('pointercancel', stopResize)
      }

      window.addEventListener('pointermove', updateLayout)
      window.addEventListener('pointerup', stopResize)
      window.addEventListener('pointercancel', stopResize)
    },
    [layout]
  )

  return {
    applyTerminalTheme,
    layout,
    setLayout,
    startLayoutResize,
    terminalThemeId
  }
}
