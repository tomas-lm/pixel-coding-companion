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
  id: string
  name: string
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
  recentOpenings: CompanionBoxOpening[]
  updatedAt?: string
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

export const STARTER_COMPANION_ID = 'ghou'

export const COMPANION_STORE_DEFINITIONS: CompanionStoreDefinition[] = [
  {
    acquisition: 'starter',
    basePrice: 0,
    id: STARTER_COMPANION_ID,
    name: 'Ghou',
    rarity: 'starter'
  },
  {
    acquisition: 'purchasable',
    basePrice: 5000,
    id: 'frogo',
    name: 'Frogo',
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
    id: 'basic_egg_box',
    name: 'Basic Egg Box',
    odds: [
      { rarity: 'starter', weight: 28 },
      { rarity: 'common', weight: 42 },
      { rarity: 'uncommon', weight: 22 },
      { rarity: 'rare', weight: 7 },
      { rarity: 'ultra_rare', weight: 0.9 },
      { rarity: 'legendary', weight: 0.1 }
    ],
    price: 10000
  },
  {
    id: 'rare_egg_box',
    name: 'Rare Egg Box',
    odds: [
      { rarity: 'starter', weight: 10 },
      { rarity: 'common', weight: 32 },
      { rarity: 'uncommon', weight: 38 },
      { rarity: 'rare', weight: 16 },
      { rarity: 'ultra_rare', weight: 3.5 },
      { rarity: 'legendary', weight: 0.5 }
    ],
    price: 50000
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

const DUPLICATE_XP_BY_RARITY: Record<CompanionRarity, number> = {
  starter: 100,
  common: 150,
  uncommon: 350,
  rare: 1200,
  ultra_rare: 4000,
  legendary: 15000,
  special: 0
}

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

export function getCompanionRarityColor(rarity: CompanionRarity): string {
  return RARITY_COLORS[rarity]
}

export function isBoxOnlyRarity(rarity: CompanionRarity): boolean {
  return rarity === 'rare' || rarity === 'ultra_rare' || rarity === 'legendary'
}

export function getDuplicateXpForRarity(rarity: CompanionRarity): number {
  return DUPLICATE_XP_BY_RARITY[rarity]
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
