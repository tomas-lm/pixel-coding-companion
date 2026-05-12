import { describe, expect, it } from 'vitest'
import {
  DEFAULT_WORKSPACE_FEATURE_SETTINGS,
  normalizeWorkspaceFeatureSettings
} from './workspaceFeatureSettings'

describe('workspaceFeatureSettings', () => {
  it('normalizes missing feature settings to defaults', () => {
    expect(normalizeWorkspaceFeatureSettings(undefined)).toEqual(DEFAULT_WORKSPACE_FEATURE_SETTINGS)
  })

  it('keeps persisted feature settings', () => {
    expect(
      normalizeWorkspaceFeatureSettings({
        keepLastDictationAudioSample: true,
        localTranscriberAudioInputDeviceId: 'mic-1',
        localTranscriberEnabled: true,
        localTranscriberShortcut: 'option-shift-hold',
        playSoundsUponFinishing: true
      })
    ).toEqual({
      keepLastDictationAudioSample: true,
      localTranscriberAudioInputDeviceId: 'mic-1',
      localTranscriberEnabled: true,
      localTranscriberShortcut: 'option-shift-hold',
      playSoundsUponFinishing: true
    })
  })

  it('falls back when persisted feature settings have invalid types', () => {
    expect(
      normalizeWorkspaceFeatureSettings({
        keepLastDictationAudioSample: 'yes',
        localTranscriberAudioInputDeviceId: 42,
        localTranscriberEnabled: 'yes',
        localTranscriberShortcut: 'fn',
        playSoundsUponFinishing: 'yes'
      })
    ).toEqual({
      keepLastDictationAudioSample: false,
      localTranscriberAudioInputDeviceId: null,
      localTranscriberEnabled: false,
      localTranscriberShortcut: 'control-option-hold',
      playSoundsUponFinishing: false
    })
  })
})
