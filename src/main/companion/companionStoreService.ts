import { readFile } from 'fs/promises'
import type { CompanionProgressState } from '../../shared/companion'
import {
  COMPANION_BOX_DEFINITIONS,
  COMPANION_STORE_DEFINITIONS,
  STARTER_COMPANION_ID,
  STARTER_COMPANION_IDS,
  getDuplicateXpForBoxPrice,
  getLocalDateKey,
  getMonsterPointsForReachedLevel,
  type CompanionBoxDefinition,
  type CompanionBoxOpenRequest,
  type CompanionBoxOpenResult,
  type CompanionBoxOpening,
  type CompanionCollectionEntry,
  type CompanionDailyAccessState,
  type CompanionRarity,
  type CompanionSelectRequest,
  type CompanionSelectResult,
  type CompanionStarterSelectRequest,
  type CompanionStarterSelectResult,
  type CompanionStoreDefinition,
  type CompanionStoreState
} from '../../shared/companionStore'
import { writeJsonFile } from '../persistence/jsonStore'

const COMPANION_MAX_LEVEL = 100
const COMPANION_BASE_NEXT_LEVEL_XP = 120
const COMPANION_LEVEL_XP_GROWTH = 1.13
const MAX_RECENT_BOX_OPENINGS = 12
const MAX_RECENT_DAILY_VISIT_DATES = 60

export function getXpRequiredForLevel(level: number): number {
  const safeLevel = Math.min(Math.max(Math.floor(level), 0), COMPANION_MAX_LEVEL)

  return Math.floor(COMPANION_BASE_NEXT_LEVEL_XP * Math.pow(COMPANION_LEVEL_XP_GROWTH, safeLevel))
}

export function createDefaultCompanionProgressState(): CompanionProgressState {
  const xpForNextLevel = getXpRequiredForLevel(0)

  return {
    currentXp: 0,
    level: 0,
    maxLevel: COMPANION_MAX_LEVEL,
    monsterPoints: 0,
    name: 'Ghou',
    progressRatio: 0,
    totalXp: 0,
    xpForNextLevel
  }
}

export function isStarterCompanionId(companionId: string): boolean {
  return STARTER_COMPANION_IDS.includes(companionId as (typeof STARTER_COMPANION_IDS)[number])
}

export function createDefaultCompanionCollectionEntry(): CompanionCollectionEntry {
  return {
    currentXp: 0,
    level: 0,
    owned: false,
    totalXp: 0
  }
}

export function createDefaultCompanionDailyAccessState(): CompanionDailyAccessState {
  return {
    boxClaims: {},
    currentStreak: 0,
    longestStreak: 0,
    recentVisitDates: [],
    totalVisitDays: 0
  }
}

export function createDefaultCompanionStoreState(): CompanionStoreState {
  return {
    activeCompanionId: STARTER_COMPANION_ID,
    companions: Object.fromEntries(
      COMPANION_STORE_DEFINITIONS.map((definition) => [
        definition.id,
        createDefaultCompanionCollectionEntry()
      ])
    ),
    dailyAccess: createDefaultCompanionDailyAccessState(),
    recentOpenings: [],
    starterSelected: false
  }
}

export function normalizeCompanionProgressState(value: unknown): CompanionProgressState {
  if (!value || typeof value !== 'object') return createDefaultCompanionProgressState()

  const state = value as Partial<CompanionProgressState>
  const level =
    typeof state.level === 'number' && Number.isFinite(state.level)
      ? Math.min(Math.max(Math.floor(state.level), 0), COMPANION_MAX_LEVEL)
      : 0
  const xpForNextLevel =
    typeof state.xpForNextLevel === 'number' && Number.isFinite(state.xpForNextLevel)
      ? Math.max(0, Math.floor(state.xpForNextLevel))
      : getXpRequiredForLevel(level)
  const currentXp =
    typeof state.currentXp === 'number' && Number.isFinite(state.currentXp)
      ? Math.min(Math.max(Math.floor(state.currentXp), 0), xpForNextLevel)
      : 0

  return {
    currentXp,
    level,
    maxLevel: COMPANION_MAX_LEVEL,
    monsterPoints:
      typeof state.monsterPoints === 'number' && Number.isFinite(state.monsterPoints)
        ? Math.max(0, Math.floor(state.monsterPoints))
        : 0,
    name: typeof state.name === 'string' && state.name.trim() ? state.name.trim() : 'Ghou',
    progressRatio: xpForNextLevel > 0 ? currentXp / xpForNextLevel : 1,
    totalXp:
      typeof state.totalXp === 'number' && Number.isFinite(state.totalXp)
        ? Math.max(0, Math.floor(state.totalXp))
        : currentXp,
    updatedAt: typeof state.updatedAt === 'string' ? state.updatedAt : undefined,
    xpForNextLevel
  }
}

export function normalizeCompanionCollectionEntry(value: unknown): CompanionCollectionEntry {
  if (!value || typeof value !== 'object') return createDefaultCompanionCollectionEntry()

  const state = value as Partial<CompanionCollectionEntry>
  const level =
    typeof state.level === 'number' && Number.isFinite(state.level)
      ? Math.min(Math.max(Math.floor(state.level), 0), COMPANION_MAX_LEVEL)
      : 0
  const xpForNextLevel = getXpRequiredForLevel(level)
  const currentXp =
    typeof state.currentXp === 'number' && Number.isFinite(state.currentXp)
      ? Math.min(Math.max(Math.floor(state.currentXp), 0), xpForNextLevel)
      : 0
  const owned = typeof state.owned === 'boolean' ? state.owned : false

  return {
    currentXp,
    level,
    owned,
    totalXp:
      typeof state.totalXp === 'number' && Number.isFinite(state.totalXp)
        ? Math.max(0, Math.floor(state.totalXp))
        : currentXp,
    unlockedAt: typeof state.unlockedAt === 'string' ? state.unlockedAt : undefined,
    updatedAt: typeof state.updatedAt === 'string' ? state.updatedAt : undefined
  }
}

export function isCompanionRarity(value: unknown): value is CompanionRarity {
  return (
    value === 'starter' ||
    value === 'common' ||
    value === 'uncommon' ||
    value === 'rare' ||
    value === 'ultra_rare' ||
    value === 'legendary' ||
    value === 'special'
  )
}

export function normalizeCompanionBoxOpening(value: unknown): CompanionBoxOpening | null {
  if (!value || typeof value !== 'object') return null

  const opening = value as Partial<CompanionBoxOpening>
  if (
    typeof opening.id !== 'string' ||
    typeof opening.boxId !== 'string' ||
    typeof opening.companionId !== 'string' ||
    typeof opening.companionName !== 'string' ||
    typeof opening.createdAt !== 'string' ||
    typeof opening.isDuplicate !== 'boolean' ||
    !isCompanionRarity(opening.rarity)
  ) {
    return null
  }

  return {
    boxId: opening.boxId,
    companionId: opening.companionId,
    companionName: opening.companionName,
    createdAt: opening.createdAt,
    duplicateXp:
      typeof opening.duplicateXp === 'number' && Number.isFinite(opening.duplicateXp)
        ? Math.max(0, Math.floor(opening.duplicateXp))
        : 0,
    id: opening.id,
    isDuplicate: opening.isDuplicate,
    rarity: opening.rarity
  }
}

export function isDateKey(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

export function normalizeCompanionDailyAccessState(value: unknown): CompanionDailyAccessState {
  if (!value || typeof value !== 'object') return createDefaultCompanionDailyAccessState()

  const state = value as Partial<CompanionDailyAccessState>
  const sourceBoxClaims =
    state.boxClaims && typeof state.boxClaims === 'object' ? state.boxClaims : {}
  const boxClaims = Object.fromEntries(
    Object.entries(sourceBoxClaims as Record<string, unknown>).filter(
      (entry): entry is [string, string] => typeof entry[0] === 'string' && isDateKey(entry[1])
    )
  )
  const recentVisitDates = Array.isArray(state.recentVisitDates)
    ? Array.from(new Set(state.recentVisitDates.filter(isDateKey))).slice(
        -MAX_RECENT_DAILY_VISIT_DATES
      )
    : []
  const totalVisitDays =
    typeof state.totalVisitDays === 'number' && Number.isFinite(state.totalVisitDays)
      ? Math.max(0, Math.floor(state.totalVisitDays))
      : recentVisitDates.length
  const currentStreak =
    typeof state.currentStreak === 'number' && Number.isFinite(state.currentStreak)
      ? Math.max(0, Math.floor(state.currentStreak))
      : 0
  const longestStreak =
    typeof state.longestStreak === 'number' && Number.isFinite(state.longestStreak)
      ? Math.max(currentStreak, Math.floor(state.longestStreak))
      : currentStreak

  return {
    boxClaims,
    currentStreak,
    lastVisitDate: isDateKey(state.lastVisitDate) ? state.lastVisitDate : undefined,
    longestStreak,
    recentVisitDates,
    totalVisitDays
  }
}

export function normalizeCompanionStoreState(value: unknown): CompanionStoreState {
  if (!value || typeof value !== 'object') return createDefaultCompanionStoreState()

  const state = value as Partial<CompanionStoreState>
  const sourceCompanions =
    state.companions && typeof state.companions === 'object' ? state.companions : {}
  let companions = Object.fromEntries(
    COMPANION_STORE_DEFINITIONS.map((definition) => [
      definition.id,
      normalizeCompanionCollectionEntry(
        (sourceCompanions as Record<string, unknown>)[definition.id]
      )
    ])
  )
  const legacyStarterCompanionId = STARTER_COMPANION_IDS.find(
    (companionId) => companions[companionId]?.owned
  )
  const requestedStarterCompanionId =
    typeof state.starterCompanionId === 'string' && isStarterCompanionId(state.starterCompanionId)
      ? state.starterCompanionId
      : undefined
  const starterSelected =
    typeof state.starterSelected === 'boolean'
      ? state.starterSelected
      : Boolean(legacyStarterCompanionId)
  const starterCompanionId = starterSelected
    ? (requestedStarterCompanionId ?? legacyStarterCompanionId ?? STARTER_COMPANION_ID)
    : undefined

  if (starterSelected && starterCompanionId) {
    companions = {
      ...companions,
      [starterCompanionId]: {
        ...companions[starterCompanionId],
        owned: true
      }
    }
  }

  const requestedActiveId =
    typeof state.activeCompanionId === 'string' ? state.activeCompanionId : STARTER_COMPANION_ID
  const activeCompanionId = companions[requestedActiveId]?.owned
    ? requestedActiveId
    : (starterCompanionId ?? STARTER_COMPANION_ID)
  const recentOpenings = Array.isArray(state.recentOpenings)
    ? state.recentOpenings
        .map(normalizeCompanionBoxOpening)
        .filter((opening): opening is CompanionBoxOpening => Boolean(opening))
        .slice(-MAX_RECENT_BOX_OPENINGS)
    : []

  return {
    activeCompanionId,
    companions,
    dailyAccess: normalizeCompanionDailyAccessState(state.dailyAccess),
    recentOpenings,
    starterCompanionId,
    starterSelected,
    updatedAt: typeof state.updatedAt === 'string' ? state.updatedAt : undefined
  }
}

export function addXpToCollectionEntry(
  entry: CompanionCollectionEntry,
  xp: number,
  updatedAt: string
): { entry: CompanionCollectionEntry; monsterPointsEarned: number } {
  const safeXp = Math.max(0, Math.floor(xp))
  let nextLevel = entry.level
  let nextCurrentXp = entry.currentXp + safeXp
  let nextXpForLevel = getXpRequiredForLevel(nextLevel)
  let monsterPointsEarned = 0

  while (nextLevel < COMPANION_MAX_LEVEL && nextCurrentXp >= nextXpForLevel) {
    nextCurrentXp -= nextXpForLevel
    nextLevel += 1
    monsterPointsEarned += getMonsterPointsForReachedLevel(nextLevel)
    nextXpForLevel = getXpRequiredForLevel(nextLevel)
  }

  if (nextLevel >= COMPANION_MAX_LEVEL) {
    nextCurrentXp = 0
  }

  return {
    entry: {
      ...entry,
      currentXp: nextCurrentXp,
      level: nextLevel,
      totalXp: entry.totalXp + safeXp,
      updatedAt
    },
    monsterPointsEarned
  }
}

export function createCompanionProgressSnapshot(
  progress: CompanionProgressState,
  state: CompanionStoreState,
  companionId = state.activeCompanionId
): CompanionProgressState {
  const companion =
    COMPANION_STORE_DEFINITIONS.find((definition) => definition.id === companionId) ??
    COMPANION_STORE_DEFINITIONS[0]
  const entry = state.companions[companion.id] ?? createDefaultCompanionCollectionEntry()
  const xpForNextLevel = getXpRequiredForLevel(entry.level)

  return {
    currentXp: entry.currentXp,
    level: entry.level,
    maxLevel: COMPANION_MAX_LEVEL,
    monsterPoints: progress.monsterPoints,
    name: companion.name,
    progressRatio:
      entry.level >= COMPANION_MAX_LEVEL || xpForNextLevel <= 0
        ? 1
        : entry.currentXp / xpForNextLevel,
    totalXp: entry.totalXp,
    updatedAt: entry.updatedAt ?? progress.updatedAt,
    xpForNextLevel
  }
}

export function getPreviousDateKey(dateKey: string): string | null {
  const date = new Date(`${dateKey}T00:00:00`)
  if (Number.isNaN(date.getTime())) return null

  date.setDate(date.getDate() - 1)
  return getLocalDateKey(date)
}

export function recordDailyAccess(
  state: CompanionStoreState,
  accessDate = getLocalDateKey()
): { state: CompanionStoreState; changed: boolean } {
  if (state.dailyAccess.lastVisitDate === accessDate) {
    return { state, changed: false }
  }

  const previousDate = getPreviousDateKey(accessDate)
  const continuesStreak = previousDate !== null && state.dailyAccess.lastVisitDate === previousDate
  const currentStreak = continuesStreak ? state.dailyAccess.currentStreak + 1 : 1
  const recentVisitDates = Array.from(
    new Set([...state.dailyAccess.recentVisitDates, accessDate])
  ).slice(-MAX_RECENT_DAILY_VISIT_DATES)

  return {
    changed: true,
    state: {
      ...state,
      dailyAccess: {
        ...state.dailyAccess,
        currentStreak,
        lastVisitDate: accessDate,
        longestStreak: Math.max(state.dailyAccess.longestStreak, currentStreak),
        recentVisitDates,
        totalVisitDays: Math.max(state.dailyAccess.totalVisitDays + 1, recentVisitDates.length)
      },
      updatedAt: new Date().toISOString()
    }
  }
}

export function rollBoxRarity(box: CompanionBoxDefinition): CompanionRarity {
  const validOdds = box.odds.filter((entry) => entry.weight > 0)
  const totalWeight = validOdds.reduce((sum, entry) => sum + entry.weight, 0)
  let cursor = Math.random() * totalWeight

  for (const entry of validOdds) {
    cursor -= entry.weight
    if (cursor <= 0) return entry.rarity
  }

  return validOdds[validOdds.length - 1]?.rarity ?? 'common'
}

export function rollCompanionFromCandidates(
  candidates: CompanionStoreDefinition[]
): CompanionStoreDefinition {
  const index = Math.floor(Math.random() * candidates.length)

  return candidates[index]
}

export function rollBoxCompanion(
  box: CompanionBoxDefinition,
  storeState: CompanionStoreState
): CompanionStoreDefinition {
  const rarity = rollBoxRarity(box)

  if (rarity === 'starter' && box.claimCadence === 'daily') {
    const unownedStarterCompanions = COMPANION_STORE_DEFINITIONS.filter(
      (definition) =>
        isStarterCompanionId(definition.id) && !storeState.companions[definition.id]?.owned
    )

    if (unownedStarterCompanions.length > 0) {
      return rollCompanionFromCandidates(unownedStarterCompanions)
    }
  }

  const availableCompanions = COMPANION_STORE_DEFINITIONS.filter(
    (definition) => definition.acquisition !== 'gifted' && definition.rarity !== 'starter'
  )
  const candidates = availableCompanions.filter((definition) => definition.rarity === rarity)
  const rollableCompanions = candidates.length > 0 ? candidates : availableCompanions

  return rollCompanionFromCandidates(rollableCompanions)
}

export class CompanionStoreService {
  constructor(
    private readonly getProgressPath: () => string,
    private readonly getStoreStatePath: () => string
  ) {}

  async loadProgress(): Promise<CompanionProgressState> {
    const [progress, storeState] = await Promise.all([
      this.readProgressState(),
      this.readStoreState()
    ])

    return createCompanionProgressSnapshot(progress, storeState)
  }

  async loadStoreState(): Promise<CompanionStoreState> {
    const accessResult = recordDailyAccess(await this.readStoreState())

    if (accessResult.changed) {
      await this.writeStoreState(accessResult.state)
    }

    return accessResult.state
  }

  async openBox(request: CompanionBoxOpenRequest): Promise<CompanionBoxOpenResult> {
    const box = COMPANION_BOX_DEFINITIONS.find((candidate) => candidate.id === request.boxId)
    if (!box) {
      throw new Error('Companion box not found.')
    }

    let progress = await this.readProgressState()
    let storeState = await this.readStoreState()
    const accessResult = recordDailyAccess(storeState)
    storeState = accessResult.state
    const today = getLocalDateKey()

    if (progress.monsterPoints < box.price) {
      throw new Error('Not enough MP to open this box.')
    }

    if (box.claimCadence === 'daily' && storeState.dailyAccess.boxClaims[box.id] === today) {
      throw new Error('Daily box already claimed today.')
    }

    const now = new Date().toISOString()
    const companion = rollBoxCompanion(box, storeState)
    const currentEntry =
      storeState.companions[companion.id] ?? createDefaultCompanionCollectionEntry()
    const isDuplicate = currentEntry.owned
    const duplicateXp = isDuplicate ? getDuplicateXpForBoxPrice(box.price) : 0

    progress = {
      ...progress,
      monsterPoints: progress.monsterPoints - box.price,
      updatedAt: now
    }

    let nextEntry: CompanionCollectionEntry = {
      ...currentEntry,
      owned: true,
      unlockedAt: currentEntry.unlockedAt ?? now,
      updatedAt: now
    }

    if (isDuplicate && duplicateXp > 0) {
      const xpResult = addXpToCollectionEntry(nextEntry, duplicateXp, now)

      nextEntry = xpResult.entry
      progress = {
        ...progress,
        monsterPoints: progress.monsterPoints + xpResult.monsterPointsEarned,
        updatedAt: now
      }
    }

    const opening: CompanionBoxOpening = {
      boxId: box.id,
      companionId: companion.id,
      companionName: companion.name,
      createdAt: now,
      duplicateXp,
      id: `opening-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      isDuplicate,
      rarity: companion.rarity
    }

    storeState = {
      ...storeState,
      companions: {
        ...storeState.companions,
        [companion.id]: nextEntry
      },
      dailyAccess:
        box.claimCadence === 'daily'
          ? {
              ...storeState.dailyAccess,
              boxClaims: {
                ...storeState.dailyAccess.boxClaims,
                [box.id]: today
              }
            }
          : storeState.dailyAccess,
      recentOpenings: [...storeState.recentOpenings, opening].slice(-MAX_RECENT_BOX_OPENINGS),
      updatedAt: now
    }

    await Promise.all([this.writeProgressState(progress), this.writeStoreState(storeState)])

    return {
      opening,
      progress: createCompanionProgressSnapshot(progress, storeState),
      storeState
    }
  }

  async selectStarter(
    request: CompanionStarterSelectRequest
  ): Promise<CompanionStarterSelectResult> {
    const companion = COMPANION_STORE_DEFINITIONS.find(
      (definition) => definition.id === request.companionId
    )
    if (!companion || !isStarterCompanionId(companion.id)) {
      throw new Error('Starter companion not found.')
    }

    const progress = await this.readProgressState()
    const storeState = await this.readStoreState()
    if (storeState.starterSelected) {
      throw new Error('Starter companion already selected.')
    }

    const now = new Date().toISOString()
    const currentEntry =
      storeState.companions[companion.id] ?? createDefaultCompanionCollectionEntry()
    const nextStoreState: CompanionStoreState = {
      ...storeState,
      activeCompanionId: companion.id,
      companions: {
        ...storeState.companions,
        [companion.id]: {
          ...currentEntry,
          owned: true,
          unlockedAt: currentEntry.unlockedAt ?? now,
          updatedAt: now
        }
      },
      starterCompanionId: companion.id,
      starterSelected: true,
      updatedAt: now
    }

    await this.writeStoreState(nextStoreState)

    return {
      progress: createCompanionProgressSnapshot(progress, nextStoreState),
      storeState: nextStoreState
    }
  }

  async selectCompanion(request: CompanionSelectRequest): Promise<CompanionSelectResult> {
    const companion = COMPANION_STORE_DEFINITIONS.find(
      (definition) => definition.id === request.companionId
    )
    if (!companion) {
      throw new Error('Companion not found.')
    }

    let storeState = await this.readStoreState()
    const companionState = storeState.companions[companion.id]

    if (!companionState?.owned) {
      throw new Error('Companion is locked.')
    }

    storeState = {
      ...storeState,
      activeCompanionId: companion.id,
      updatedAt: new Date().toISOString()
    }

    await this.writeStoreState(storeState)

    return { storeState }
  }

  private async readProgressState(): Promise<CompanionProgressState> {
    try {
      const file = await readFile(this.getProgressPath(), 'utf8')
      return normalizeCompanionProgressState(JSON.parse(file))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return createDefaultCompanionProgressState()
      }

      throw error
    }
  }

  private async writeProgressState(progress: CompanionProgressState): Promise<void> {
    await writeJsonFile(this.getProgressPath(), progress)
  }

  private async readStoreState(): Promise<CompanionStoreState> {
    try {
      const file = await readFile(this.getStoreStatePath(), 'utf8')
      return normalizeCompanionStoreState(JSON.parse(file))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return createDefaultCompanionStoreState()
      }

      throw error
    }
  }

  private async writeStoreState(state: CompanionStoreState): Promise<void> {
    await writeJsonFile(this.getStoreStatePath(), state)
  }
}
