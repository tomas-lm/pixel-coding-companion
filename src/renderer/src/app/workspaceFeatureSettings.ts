import type { WorkspaceFeatureSettings } from '../../../shared/workspace'

export const DEFAULT_WORKSPACE_FEATURE_SETTINGS: WorkspaceFeatureSettings = {
  playSoundsUponFinishing: false
}

export function normalizeWorkspaceFeatureSettings(value: unknown): WorkspaceFeatureSettings {
  if (!value || typeof value !== 'object') {
    return DEFAULT_WORKSPACE_FEATURE_SETTINGS
  }

  const settings = value as Partial<Record<keyof WorkspaceFeatureSettings, unknown>>

  return {
    playSoundsUponFinishing:
      typeof settings.playSoundsUponFinishing === 'boolean'
        ? settings.playSoundsUponFinishing
        : DEFAULT_WORKSPACE_FEATURE_SETTINGS.playSoundsUponFinishing
  }
}
