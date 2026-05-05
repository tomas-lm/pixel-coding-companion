import { CODE_EDITOR_OPTIONS, type CodeEditorId } from '../../../shared/system'
import type { WorkspaceCodeEditorSettings } from '../../../shared/workspace'

export const DEFAULT_WORKSPACE_CODE_EDITOR_SETTINGS: WorkspaceCodeEditorSettings = {
  preferredEditor: 'auto'
}

function isCodeEditorId(value: unknown): value is CodeEditorId {
  return CODE_EDITOR_OPTIONS.some((option) => option.id === value)
}

export function normalizeWorkspaceCodeEditorSettings(value: unknown): WorkspaceCodeEditorSettings {
  if (!value || typeof value !== 'object') {
    return DEFAULT_WORKSPACE_CODE_EDITOR_SETTINGS
  }

  const settings = value as Partial<Record<keyof WorkspaceCodeEditorSettings, unknown>>

  return {
    preferredEditor: isCodeEditorId(settings.preferredEditor)
      ? settings.preferredEditor
      : DEFAULT_WORKSPACE_CODE_EDITOR_SETTINGS.preferredEditor
  }
}
