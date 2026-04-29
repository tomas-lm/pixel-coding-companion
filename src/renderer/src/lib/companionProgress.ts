const MIN_COMPANION_LEVEL = 0
const MAX_COMPANION_LEVEL = 100
const BASE_NEXT_LEVEL_XP = 120
const LEVEL_XP_GROWTH = 1.13

export type CompanionProgress = {
  currentXp: number
  level: number
  maxLevel: number
  name: string
  progressRatio: number
  xpForNextLevel: number
}

export type CompanionProgressInput = {
  currentXp?: number
  level?: number
  name?: string
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function getXpRequiredForLevel(level: number): number {
  const safeLevel = clamp(Math.floor(level), MIN_COMPANION_LEVEL, MAX_COMPANION_LEVEL)

  return Math.floor(BASE_NEXT_LEVEL_XP * Math.pow(LEVEL_XP_GROWTH, safeLevel))
}

export function createCompanionProgressSnapshot(
  input: CompanionProgressInput = {}
): CompanionProgress {
  const level = clamp(
    Math.floor(input.level ?? MIN_COMPANION_LEVEL),
    MIN_COMPANION_LEVEL,
    MAX_COMPANION_LEVEL
  )
  const xpForNextLevel = getXpRequiredForLevel(level)
  const currentXp = clamp(Math.floor(input.currentXp ?? 0), 0, xpForNextLevel)

  return {
    currentXp,
    level,
    maxLevel: MAX_COMPANION_LEVEL,
    name: input.name?.trim() || 'Ghou',
    progressRatio: xpForNextLevel > 0 ? currentXp / xpForNextLevel : 1,
    xpForNextLevel
  }
}
