import { afterEach, describe, expect, it } from 'vitest'
import type { CompanionStoreState } from '../../../shared/companionStore'
import {
  applyDevCompanionLevelOverrides,
  readDevCompanionLevelOverrides,
  saveDevCompanionLevelOverride
} from './devCompanionLevelOverrides'

function createStoreState(): CompanionStoreState {
  return {
    activeCompanionId: 'karpa',
    companions: {
      frogo: {
        currentXp: 10,
        level: 2,
        owned: false,
        totalXp: 200
      },
      karpa: {
        currentXp: 40,
        level: 4,
        owned: true,
        totalXp: 1200
      }
    },
    dailyAccess: {
      boxClaims: {},
      currentStreak: 0,
      longestStreak: 0,
      recentVisitDates: [],
      totalVisitDays: 0
    },
    recentOpenings: [],
    starterSelected: true
  }
}

describe('devCompanionLevelOverrides', () => {
  afterEach(() => {
    window.localStorage.clear()
  })

  it('saves and reads clamped companion level overrides', () => {
    saveDevCompanionLevelOverride('karpa', 125)

    expect(readDevCompanionLevelOverrides()).toEqual({
      karpa: 100
    })
  })

  it('applies overrides to owned companions without mutating locked companions', () => {
    saveDevCompanionLevelOverride('karpa', 25)
    saveDevCompanionLevelOverride('frogo', 50)

    const state = applyDevCompanionLevelOverrides(createStoreState())

    expect(state.companions.karpa).toMatchObject({
      currentXp: 0,
      level: 25,
      owned: true,
      totalXp: 1200
    })
    expect(state.companions.frogo).toMatchObject({
      currentXp: 10,
      level: 2,
      owned: false,
      totalXp: 200
    })
  })

  it('can lower an owned companion below the persisted level for dev testing', () => {
    saveDevCompanionLevelOverride('karpa', 1)

    const state = applyDevCompanionLevelOverrides(createStoreState())

    expect(state.companions.karpa).toMatchObject({
      currentXp: 0,
      level: 1
    })
  })
})
