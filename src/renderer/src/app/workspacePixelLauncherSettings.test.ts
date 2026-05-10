import { describe, expect, it } from 'vitest'
import {
  DEFAULT_WORKSPACE_PIXEL_LAUNCHER_SETTINGS,
  normalizeWorkspacePixelLauncherSettings
} from './workspacePixelLauncherSettings'

describe('workspace pixel launcher settings', () => {
  it('defaults to auto-detect', () => {
    expect(normalizeWorkspacePixelLauncherSettings(undefined)).toEqual(
      DEFAULT_WORKSPACE_PIXEL_LAUNCHER_SETTINGS
    )
  })

  it('keeps a valid preferred agent', () => {
    expect(normalizeWorkspacePixelLauncherSettings({ preferredAgent: 'codex' })).toEqual({
      preferredAgent: 'codex'
    })
  })

  it('repairs invalid preferred agents', () => {
    expect(normalizeWorkspacePixelLauncherSettings({ preferredAgent: 'cursor' })).toEqual({
      preferredAgent: 'auto'
    })
  })
})
