import { describe, expect, it } from 'vitest'
import { createCompanionProgressSnapshot, getXpRequiredForLevel } from './companionProgress'

describe('companionProgress', () => {
  it('creates a default Ghou progress snapshot', () => {
    expect(createCompanionProgressSnapshot()).toMatchObject({
      currentXp: 0,
      level: 0,
      maxLevel: 100,
      monsterPoints: 0,
      name: 'Ghou',
      progressRatio: 0,
      totalXp: 0,
      xpForNextLevel: 120
    })
  })

  it('clamps unsafe values into the supported progress range', () => {
    const progress = createCompanionProgressSnapshot({
      currentXp: 999999999,
      level: 500,
      monsterPoints: -10,
      name: '  ',
      totalXp: -5
    })

    expect(progress.level).toBe(100)
    expect(progress.currentXp).toBe(progress.xpForNextLevel)
    expect(progress.monsterPoints).toBe(0)
    expect(progress.name).toBe('Ghou')
    expect(progress.progressRatio).toBe(1)
    expect(progress.totalXp).toBe(0)
  })

  it('uses a growing XP curve for later levels', () => {
    expect(getXpRequiredForLevel(10)).toBeGreaterThan(getXpRequiredForLevel(1))
  })
})
