import { describe, expect, it } from 'vitest'
import {
  addXpToCollectionEntry,
  createCompanionProgressSnapshot,
  createDefaultCompanionProgressState,
  createDefaultCompanionStoreState,
  normalizeCompanionStoreState,
  recordDailyAccess
} from './companionStoreService'

describe('companionStoreService domain model', () => {
  it('creates progress snapshots from the active companion entry', () => {
    const progress = {
      ...createDefaultCompanionProgressState(),
      monsterPoints: 42
    }
    const storeState = createDefaultCompanionStoreState()

    storeState.activeCompanionId = 'raya'
    storeState.companions.ghou = {
      currentXp: 10,
      level: 0,
      owned: true,
      totalXp: 10
    }
    storeState.companions.raya = {
      currentXp: 55,
      level: 2,
      owned: true,
      totalXp: 500,
      updatedAt: '2026-05-02T10:00:00.000Z'
    }

    expect(createCompanionProgressSnapshot(progress, storeState)).toMatchObject({
      currentXp: 55,
      level: 2,
      monsterPoints: 42,
      name: 'Raya',
      totalXp: 500,
      updatedAt: '2026-05-02T10:00:00.000Z'
    })
  })

  it('levels a single companion entry and returns earned monster points', () => {
    const result = addXpToCollectionEntry(
      {
        currentXp: 0,
        level: 0,
        owned: true,
        totalXp: 0
      },
      130,
      '2026-05-02T10:00:00.000Z'
    )

    expect(result).toMatchObject({
      entry: {
        currentXp: 10,
        level: 1,
        totalXp: 130,
        updatedAt: '2026-05-02T10:00:00.000Z'
      },
      monsterPointsEarned: 500
    })
  })

  it('records daily access once per date and continues streaks', () => {
    const storeState = createDefaultCompanionStoreState()
    storeState.dailyAccess = {
      boxClaims: {},
      currentStreak: 1,
      lastVisitDate: '2026-05-01',
      longestStreak: 1,
      recentVisitDates: ['2026-05-01'],
      totalVisitDays: 1
    }

    const firstAccess = recordDailyAccess(storeState, '2026-05-02')
    const secondAccess = recordDailyAccess(firstAccess.state, '2026-05-02')

    expect(firstAccess.changed).toBe(true)
    expect(firstAccess.state.dailyAccess).toMatchObject({
      currentStreak: 2,
      lastVisitDate: '2026-05-02',
      longestStreak: 2,
      recentVisitDates: ['2026-05-01', '2026-05-02'],
      totalVisitDays: 2
    })
    expect(secondAccess.changed).toBe(false)
  })

  it('normalizes legacy starter ownership into starter selection state', () => {
    const state = normalizeCompanionStoreState({
      activeCompanionId: 'frogo',
      companions: {
        frogo: {
          currentXp: 7,
          level: 0,
          owned: true,
          totalXp: 7
        }
      }
    })

    expect(state).toMatchObject({
      activeCompanionId: 'frogo',
      starterCompanionId: 'frogo',
      starterSelected: true
    })
    expect(state.companions.frogo).toMatchObject({
      currentXp: 7,
      owned: true,
      totalXp: 7
    })
  })
})
