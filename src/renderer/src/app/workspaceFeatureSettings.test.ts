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
    expect(normalizeWorkspaceFeatureSettings({ playSoundsUponFinishing: true })).toEqual({
      playSoundsUponFinishing: true
    })
  })

  it('falls back when persisted feature settings have invalid types', () => {
    expect(normalizeWorkspaceFeatureSettings({ playSoundsUponFinishing: 'yes' })).toEqual({
      playSoundsUponFinishing: false
    })
  })
})
