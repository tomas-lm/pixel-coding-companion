export type CompanionRarity =
  | 'starter'
  | 'common'
  | 'uncommon'
  | 'rare'
  | 'ultra_rare'
  | 'legendary'
  | 'special'

export type CompanionAcquisition = 'box_only' | 'gifted' | 'purchasable' | 'starter'

export type CompanionStoreDefinition = {
  acquisition: CompanionAcquisition
  basePrice: number
  description?: string
  id: string
  name: string
  personalityHint?: string
  rarity: CompanionRarity
}

export type CompanionCollectionEntry = {
  currentXp: number
  level: number
  owned: boolean
  totalXp: number
  unlockedAt?: string
  updatedAt?: string
}

export type CompanionBoxRarityOdds = {
  rarity: CompanionRarity
  weight: number
}

export type CompanionBoxDefinition = {
  claimCadence?: 'daily'
  id: string
  name: string
  odds: CompanionBoxRarityOdds[]
  price: number
}

export type CompanionBoxOpening = {
  boxId: string
  companionId: string
  companionName: string
  createdAt: string
  duplicateXp: number
  id: string
  isDuplicate: boolean
  rarity: CompanionRarity
}

export type CompanionStoreState = {
  activeCompanionId: string
  companions: Record<string, CompanionCollectionEntry>
  dailyAccess: CompanionDailyAccessState
  recentOpenings: CompanionBoxOpening[]
  starterCompanionId?: string
  starterSelected: boolean
  updatedAt?: string
}

export type CompanionDailyAccessState = {
  boxClaims: Record<string, string>
  currentStreak: number
  lastVisitDate?: string
  longestStreak: number
  recentVisitDates: string[]
  totalVisitDays: number
}

export type CompanionBoxOpenRequest = {
  boxId: string
}

export type CompanionBoxOpenResult = {
  opening: CompanionBoxOpening
  progress: import('./companion').CompanionProgressState
  storeState: CompanionStoreState
}

export type CompanionSelectRequest = {
  companionId: string
}

export type CompanionSelectResult = {
  storeState: CompanionStoreState
}

export type CompanionStarterSelectRequest = {
  companionId: string
}

export type CompanionStarterSelectResult = {
  progress: import('./companion').CompanionProgressState
  storeState: CompanionStoreState
}

export const STARTER_COMPANION_ID = 'ghou'
export const STARTER_COMPANION_IDS = ['ghou', 'frogo', 'combot'] as const
export type StarterCompanionId = (typeof STARTER_COMPANION_IDS)[number]

export const COMPANION_STORE_DEFINITIONS: CompanionStoreDefinition[] = [
  {
    acquisition: 'starter',
    basePrice: 0,
    description: 'The magic ghost',
    id: STARTER_COMPANION_ID,
    name: 'Ghou',
    personalityHint: 'Calm, observant, and quietly useful.',
    rarity: 'starter'
  },
  {
    acquisition: 'starter',
    basePrice: 0,
    description: 'The brave frog',
    id: 'frogo',
    name: 'Frogo',
    personalityHint: 'Bold, upbeat, and ready to hop into messy work.',
    rarity: 'starter'
  },
  {
    acquisition: 'starter',
    basePrice: 0,
    description: 'The conquering robot',
    id: 'combot',
    name: 'Combot',
    personalityHint: 'Precise, ambitious, and built for structured progress.',
    rarity: 'starter'
  },
  {
    acquisition: 'purchasable',
    basePrice: 10000,
    id: 'raya',
    name: 'Raya',
    rarity: 'common'
  },
  {
    acquisition: 'purchasable',
    basePrice: 15000,
    id: 'buba',
    name: 'Buba',
    rarity: 'uncommon'
  },
  {
    acquisition: 'box_only',
    basePrice: 12500,
    id: 'karpa',
    name: 'Karpa',
    rarity: 'rare'
  },
  {
    acquisition: 'box_only',
    basePrice: 15000,
    id: 'drago',
    name: 'Drago',
    rarity: 'ultra_rare'
  },
  {
    acquisition: 'box_only',
    basePrice: 10000,
    id: 'phoebe',
    name: 'Phoebe',
    rarity: 'legendary'
  },
  {
    acquisition: 'gifted',
    basePrice: 0,
    id: 'corax',
    name: 'Corax',
    rarity: 'special'
  }
]

export const COMPANION_BOX_DEFINITIONS: CompanionBoxDefinition[] = [
  {
    claimCadence: 'daily',
    id: 'daily_egg_box',
    name: 'Daily Box',
    odds: [
      { rarity: 'starter', weight: 1 },
      { rarity: 'common', weight: 93 },
      { rarity: 'uncommon', weight: 5 },
      { rarity: 'rare', weight: 0.8 },
      { rarity: 'ultra_rare', weight: 0.19 },
      { rarity: 'legendary', weight: 0.01 }
    ],
    price: 0
  },
  {
    id: 'basic_egg_box',
    name: 'Basic Egg Box',
    odds: [
      { rarity: 'common', weight: 60 },
      { rarity: 'uncommon', weight: 30 },
      { rarity: 'rare', weight: 8.5 },
      { rarity: 'ultra_rare', weight: 1.3 },
      { rarity: 'legendary', weight: 0.2 }
    ],
    price: 10000
  },
  {
    id: 'uncommon_egg_box',
    name: 'Uncommon Box',
    odds: [
      { rarity: 'common', weight: 40 },
      { rarity: 'uncommon', weight: 50 },
      { rarity: 'rare', weight: 8 },
      { rarity: 'ultra_rare', weight: 1.8 },
      { rarity: 'legendary', weight: 0.2 }
    ],
    price: 25000
  },
  {
    id: 'rare_egg_box',
    name: 'Rare Egg Box',
    odds: [
      { rarity: 'common', weight: 35 },
      { rarity: 'uncommon', weight: 42 },
      { rarity: 'rare', weight: 18 },
      { rarity: 'ultra_rare', weight: 4.4 },
      { rarity: 'legendary', weight: 0.6 }
    ],
    price: 50000
  },
  {
    id: 'ultra_rare_egg_box',
    name: 'Ultra Rare Box',
    odds: [
      { rarity: 'common', weight: 5 },
      { rarity: 'uncommon', weight: 25 },
      { rarity: 'rare', weight: 35 },
      { rarity: 'ultra_rare', weight: 32 },
      { rarity: 'legendary', weight: 3 }
    ],
    price: 125000
  },
  {
    id: 'legendary_egg_box',
    name: 'Legendary Egg Box',
    odds: [
      { rarity: 'common', weight: 10 },
      { rarity: 'uncommon', weight: 36 },
      { rarity: 'rare', weight: 34 },
      { rarity: 'ultra_rare', weight: 16 },
      { rarity: 'legendary', weight: 4 }
    ],
    price: 200000
  }
]

const RARITY_PRICE_MULTIPLIERS: Record<CompanionRarity, number> = {
  starter: 1,
  common: 1,
  uncommon: 3,
  rare: 8,
  ultra_rare: 20,
  legendary: 60,
  special: 0
}

const FREE_BOX_DUPLICATE_XP = 100
const DUPLICATE_XP_BOX_PRICE_RATE = 0.08
const DUPLICATE_XP_ROUNDING = 50

export const RARITY_COLORS: Record<CompanionRarity, string> = {
  starter: '#f97316',
  common: '#4ea1ff',
  uncommon: '#c66b4e',
  rare: '#ef5b5b',
  ultra_rare: '#c084fc',
  legendary: '#f7d56f',
  special: '#34d399'
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

export function getLocalDateKey(date = new Date()): string {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')

  return `${year}-${month}-${day}`
}

export function getCompanionRarityColor(rarity: CompanionRarity): string {
  return RARITY_COLORS[rarity]
}

export function isBoxOnlyRarity(rarity: CompanionRarity): boolean {
  return rarity === 'rare' || rarity === 'ultra_rare' || rarity === 'legendary'
}

export function getDuplicateXpForBoxPrice(price: number): number {
  const safePrice = Math.max(0, Math.floor(price))

  if (safePrice <= 0) return FREE_BOX_DUPLICATE_XP

  const rawDuplicateXp = safePrice * DUPLICATE_XP_BOX_PRICE_RATE

  return Math.max(
    FREE_BOX_DUPLICATE_XP,
    Math.round(rawDuplicateXp / DUPLICATE_XP_ROUNDING) * DUPLICATE_XP_ROUNDING
  )
}

export function formatMonsterPoints(value: number): string {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 0
  }).format(Math.max(0, Math.floor(value)))
}

export function formatCompanionRarity(rarity: CompanionRarity): string {
  if (rarity === 'starter') return 'Starter'
  if (rarity === 'ultra_rare') return 'Ultra rare'
  return `${rarity.charAt(0).toUpperCase()}${rarity.slice(1)}`
}
