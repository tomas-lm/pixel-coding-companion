import { describe, expect, it } from 'vitest'
import {
  formatCompanionRarity,
  getCompanionPrice,
  getDuplicateXpForBoxPrice,
  getMonsterPointsForReachedLevel,
  isBoxOnlyRarity
} from './companionStore'

describe('companionStore economy', () => {
  it('keeps early monster point rewards cheap and late levels valuable', () => {
    expect(getMonsterPointsForReachedLevel(0)).toBe(0)
    expect(getMonsterPointsForReachedLevel(1)).toBe(500)
    expect(getMonsterPointsForReachedLevel(2)).toBe(500)
    expect(getMonsterPointsForReachedLevel(100)).toBe(500000)
  })

  it('prices companions by rarity multiplier', () => {
    expect(getCompanionPrice(10000, 'common')).toBe(10000)
    expect(getCompanionPrice(10000, 'uncommon')).toBe(30000)
    expect(getCompanionPrice(10000, 'rare')).toBe(80000)
    expect(getCompanionPrice(10000, 'special')).toBe(0)
  })

  it('derives duplicate XP from the opened box price with a free-box floor', () => {
    expect(getDuplicateXpForBoxPrice(0)).toBe(100)
    expect(getDuplicateXpForBoxPrice(10000)).toBe(800)
    expect(getDuplicateXpForBoxPrice(125000)).toBe(10000)
  })

  it('identifies box-only rarities', () => {
    expect(isBoxOnlyRarity('common')).toBe(false)
    expect(isBoxOnlyRarity('rare')).toBe(true)
    expect(isBoxOnlyRarity('ultra_rare')).toBe(true)
    expect(isBoxOnlyRarity('legendary')).toBe(true)
  })

  it('formats rarity labels for the store UI', () => {
    expect(formatCompanionRarity('starter')).toBe('Starter')
    expect(formatCompanionRarity('ultra_rare')).toBe('Ultra rare')
    expect(formatCompanionRarity('legendary')).toBe('Legendary')
  })
})
