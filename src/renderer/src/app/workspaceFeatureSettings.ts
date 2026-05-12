import { isDictationShortcutId } from '../../../shared/dictation'
import type { WorkspaceFeatureSettings } from '../../../shared/workspace'

export const DEFAULT_WORKSPACE_FEATURE_SETTINGS: WorkspaceFeatureSettings = {
  keepLastDictationAudioSample: false,
  localTranscriberEnabled: false,
  localTranscriberShortcut: 'control-option-hold',
  playSoundsUponFinishing: false
}

export function normalizeWorkspaceFeatureSettings(value: unknown): WorkspaceFeatureSettings {
  if (!value || typeof value !== 'object') {
    return DEFAULT_WORKSPACE_FEATURE_SETTINGS
  }

  const settings = value as Partial<Record<keyof WorkspaceFeatureSettings, unknown>>

  return {
    keepLastDictationAudioSample:
      typeof settings.keepLastDictationAudioSample === 'boolean'
        ? settings.keepLastDictationAudioSample
        : DEFAULT_WORKSPACE_FEATURE_SETTINGS.keepLastDictationAudioSample,
    localTranscriberEnabled:
      typeof settings.localTranscriberEnabled === 'boolean'
        ? settings.localTranscriberEnabled
        : DEFAULT_WORKSPACE_FEATURE_SETTINGS.localTranscriberEnabled,
    localTranscriberShortcut: isDictationShortcutId(settings.localTranscriberShortcut)
      ? settings.localTranscriberShortcut
      : DEFAULT_WORKSPACE_FEATURE_SETTINGS.localTranscriberShortcut,
    playSoundsUponFinishing:
      typeof settings.playSoundsUponFinishing === 'boolean'
        ? settings.playSoundsUponFinishing
        : DEFAULT_WORKSPACE_FEATURE_SETTINGS.playSoundsUponFinishing
  }
}
