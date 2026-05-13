import { describe, expect, it } from 'vitest'
import { hasContextRail, shouldShowVaultRail, shouldShowWorkspaceRail } from './activityLayout'

describe('activity layout', () => {
  it('shows the workspace rail only on the terminal activity', () => {
    expect(shouldShowWorkspaceRail('terminal')).toBe(true)
    expect(shouldShowWorkspaceRail('dictation')).toBe(false)
    expect(shouldShowWorkspaceRail('configs')).toBe(false)
    expect(shouldShowWorkspaceRail('prompts')).toBe(false)
    expect(shouldShowWorkspaceRail('companions')).toBe(false)
    expect(shouldShowWorkspaceRail('vaults')).toBe(false)
  })

  it('keeps the vault rail scoped to the vaults activity', () => {
    expect(shouldShowVaultRail('vaults')).toBe(true)
    expect(shouldShowVaultRail('terminal')).toBe(false)
    expect(shouldShowVaultRail('dictation')).toBe(false)
  })

  it('reports whether an activity owns a contextual rail', () => {
    expect(hasContextRail('terminal')).toBe(true)
    expect(hasContextRail('vaults')).toBe(true)
    expect(hasContextRail('dictation')).toBe(false)
  })
})
