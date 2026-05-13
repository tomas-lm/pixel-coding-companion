import { isDictationShortcutId } from '../../../shared/dictation'
import type { WorkspaceFeatureSettings } from '../../../shared/workspace'

export const DEFAULT_WORKSPACE_FEATURE_SETTINGS: WorkspaceFeatureSettings = {
  dictationOverlayEnabled: false,
  keepDictationAudioHistory: false,
  keepDictationTranscriptHistory: true,
  keepLastDictationAudioSample: false,
  localTranscriberAudioInputDeviceId: null,
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
    dictationOverlayEnabled:
      typeof settings.dictationOverlayEnabled === 'boolean'
        ? settings.dictationOverlayEnabled
        : DEFAULT_WORKSPACE_FEATURE_SETTINGS.dictationOverlayEnabled,
    keepDictationAudioHistory:
      typeof settings.keepDictationAudioHistory === 'boolean'
        ? settings.keepDictationAudioHistory
        : DEFAULT_WORKSPACE_FEATURE_SETTINGS.keepDictationAudioHistory,
    keepDictationTranscriptHistory:
      typeof settings.keepDictationTranscriptHistory === 'boolean'
        ? settings.keepDictationTranscriptHistory
        : DEFAULT_WORKSPACE_FEATURE_SETTINGS.keepDictationTranscriptHistory,
    keepLastDictationAudioSample:
      typeof settings.keepLastDictationAudioSample === 'boolean'
        ? settings.keepLastDictationAudioSample
        : DEFAULT_WORKSPACE_FEATURE_SETTINGS.keepLastDictationAudioSample,
    localTranscriberAudioInputDeviceId:
      typeof settings.localTranscriberAudioInputDeviceId === 'string'
        ? settings.localTranscriberAudioInputDeviceId
        : DEFAULT_WORKSPACE_FEATURE_SETTINGS.localTranscriberAudioInputDeviceId,
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
