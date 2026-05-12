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
        localTranscriberEnabled: true,
        playSoundsUponFinishing: true
      })
    ).toEqual({
      keepLastDictationAudioSample: true,
      localTranscriberEnabled: true,
      playSoundsUponFinishing: true
    })
  })

  it('falls back when persisted feature settings have invalid types', () => {
    expect(
      normalizeWorkspaceFeatureSettings({
        keepLastDictationAudioSample: 'yes',
        localTranscriberEnabled: 'yes',
        playSoundsUponFinishing: 'yes'
      })
    ).toEqual({
      keepLastDictationAudioSample: false,
      localTranscriberEnabled: false,
      playSoundsUponFinishing: false
    })
  })
})
