import {
  DEFAULT_TERMINAL_THEME_ID,
  type TerminalThemeId,
  type WorkspaceLayout,
  isTerminalThemeId
} from '../../../shared/workspace'

export type LayoutResizeTarget = keyof WorkspaceLayout

export const DEFAULT_LAYOUT: WorkspaceLayout = {
  railWidth: 300,
  companionWidth: 320,
  projectsHeight: 178,
  terminalsHeight: 340
}

const LAYOUT_LIMITS: Record<keyof WorkspaceLayout, { min: number; max: number }> = {
  railWidth: { min: 240, max: 520 },
  companionWidth: { min: 220, max: 520 },
  projectsHeight: { min: 110, max: 360 },
  terminalsHeight: { min: 130, max: 640 }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function normalizeLayout(layout?: Partial<WorkspaceLayout>): WorkspaceLayout {
  return Object.fromEntries(
    Object.entries(DEFAULT_LAYOUT).map(([key, fallback]) => {
      const layoutKey = key as keyof WorkspaceLayout
      const value = layout?.[layoutKey]
      const limits = LAYOUT_LIMITS[layoutKey]
      const numericValue = typeof value === 'number' && Number.isFinite(value) ? value : fallback

      return [layoutKey, clamp(numericValue, limits.min, limits.max)]
    })
  ) as WorkspaceLayout
}

export function normalizeTerminalThemeId(themeId?: unknown): TerminalThemeId {
  return isTerminalThemeId(themeId) ? themeId : DEFAULT_TERMINAL_THEME_ID
}
