import { describe, expect, it } from 'vitest'
import { DEFAULT_TERMINAL_THEME_ID } from '../../../shared/workspace'
import { DEFAULT_LAYOUT, normalizeLayout, normalizeTerminalThemeId } from './layout'

describe('workspace layout helpers', () => {
  it('uses the default layout when no persisted layout exists', () => {
    expect(normalizeLayout()).toEqual(DEFAULT_LAYOUT)
  })

  it('clamps persisted layout values to supported bounds', () => {
    expect(
      normalizeLayout({
        companionWidth: 9999,
        projectsHeight: -1,
        railWidth: 100,
        terminalsHeight: Number.NaN
      })
    ).toEqual({
      companionWidth: 520,
      projectsHeight: 110,
      railWidth: 240,
      terminalsHeight: DEFAULT_LAYOUT.terminalsHeight
    })
  })

  it('keeps known terminal themes and falls back for unknown values', () => {
    expect(normalizeTerminalThemeId('dracula')).toBe('dracula')
    expect(normalizeTerminalThemeId('unknown-theme')).toBe(DEFAULT_TERMINAL_THEME_ID)
  })
})
