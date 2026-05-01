import type { CompanionRarity } from './companionTypes'

const RARITY_PRICE_MULTIPLIERS: Record<CompanionRarity, number> = {
  starter: 0,
  common: 1,
  uncommon: 3,
  rare: 8,
  epic: 20,
  legendary: 60
}

export function getMonsterPointsForReachedLevel(level: number): number {
  const safeLevel = Math.max(0, Math.floor(level))

  if (safeLevel <= 0) return 0
  if (safeLevel <= 2) return 500

  const progress = (safeLevel - 2) / 98
  const rawReward = 500 + 499500 * Math.pow(progress, 2.2)

  return Math.round(rawReward / 50) * 50
}

export function getCompanionPrice(basePrice: number, rarity: CompanionRarity): number {
  return Math.max(0, Math.floor(basePrice * RARITY_PRICE_MULTIPLIERS[rarity]))
}

export function formatMonsterPoints(value: number): string {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 0
  }).format(Math.max(0, Math.floor(value)))
}

export function formatCompanionRarity(rarity: CompanionRarity): string {
  if (rarity === 'starter') return 'Starter'
  return `${rarity.charAt(0).toUpperCase()}${rarity.slice(1)}`
}
