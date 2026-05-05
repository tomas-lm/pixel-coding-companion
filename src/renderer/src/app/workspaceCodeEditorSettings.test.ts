import { describe, expect, it } from 'vitest'
import {
  DEFAULT_WORKSPACE_CODE_EDITOR_SETTINGS,
  normalizeWorkspaceCodeEditorSettings
} from './workspaceCodeEditorSettings'

describe('normalizeWorkspaceCodeEditorSettings', () => {
  it('falls back to auto when settings are missing', () => {
    expect(normalizeWorkspaceCodeEditorSettings(undefined)).toEqual(
      DEFAULT_WORKSPACE_CODE_EDITOR_SETTINGS
    )
  })

  it('keeps a valid preferred editor', () => {
    expect(normalizeWorkspaceCodeEditorSettings({ preferredEditor: 'cursor' })).toEqual({
      preferredEditor: 'cursor'
    })
  })

  it('rejects unknown editor ids', () => {
    expect(normalizeWorkspaceCodeEditorSettings({ preferredEditor: 'sublime' })).toEqual({
      preferredEditor: 'auto'
    })
  })
})
