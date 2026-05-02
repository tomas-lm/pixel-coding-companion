/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { COMPANION_PROFILES } from './companion-profile.mjs'

const STARTER_COMPANION_ID = 'ghou'
const MAX_COMPANION_LEVEL = 100
const BASE_NEXT_LEVEL_XP = 120
const LEVEL_XP_GROWTH = 1.13
const COMPANION_IDS = Object.keys(COMPANION_PROFILES)

function getXpRequiredForLevel(level) {
  const safeLevel = Math.min(Math.max(Math.floor(level), 0), MAX_COMPANION_LEVEL)

  return Math.floor(BASE_NEXT_LEVEL_XP * Math.pow(LEVEL_XP_GROWTH, safeLevel))
}

function getMonsterPointsForReachedLevel(level) {
  const safeLevel = Math.max(0, Math.floor(level))

  if (safeLevel <= 0) return 0
  if (safeLevel <= 2) return 500

  const progress = (safeLevel - 2) / 98
  const rawReward = 500 + 499500 * Math.pow(progress, 2.2)

  return Math.round(rawReward / 50) * 50
}

function getCompanionName(companionId) {
  return COMPANION_PROFILES[companionId]?.name ?? COMPANION_PROFILES[STARTER_COMPANION_ID].name
}

function createDefaultCollectionEntry() {
  return {
    currentXp: 0,
    level: 0,
    owned: false,
    totalXp: 0
  }
}

function normalizeCollectionEntry(value) {
  if (!value || typeof value !== 'object') return createDefaultCollectionEntry()

  const level =
    typeof value.level === 'number' && Number.isFinite(value.level)
      ? Math.min(Math.max(Math.floor(value.level), 0), MAX_COMPANION_LEVEL)
      : 0
  const xpForNextLevel = getXpRequiredForLevel(level)
  const currentXp =
    typeof value.currentXp === 'number' && Number.isFinite(value.currentXp)
      ? Math.min(Math.max(Math.floor(value.currentXp), 0), xpForNextLevel)
      : 0

  return {
    currentXp,
    level,
    owned: typeof value.owned === 'boolean' ? value.owned : false,
    totalXp:
      typeof value.totalXp === 'number' && Number.isFinite(value.totalXp)
        ? Math.max(0, Math.floor(value.totalXp))
        : currentXp,
    unlockedAt: typeof value.unlockedAt === 'string' ? value.unlockedAt : undefined,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : undefined
  }
}

function createDefaultStoreState() {
  return {
    activeCompanionId: STARTER_COMPANION_ID,
    companions: Object.fromEntries(
      COMPANION_IDS.map((companionId) => [companionId, createDefaultCollectionEntry()])
    ),
    dailyAccess: {
      boxClaims: {},
      currentStreak: 0,
      longestStreak: 0,
      recentVisitDates: [],
      totalVisitDays: 0
    },
    recentOpenings: [],
    starterSelected: false
  }
}

function normalizeStoreState(value) {
  if (!value || typeof value !== 'object') return createDefaultStoreState()

  const sourceCompanions =
    value.companions && typeof value.companions === 'object' ? value.companions : {}
  const companions = Object.fromEntries(
    COMPANION_IDS.map((companionId) => [
      companionId,
      normalizeCollectionEntry(sourceCompanions[companionId])
    ])
  )
  const starterCompanionId =
    typeof value.starterCompanionId === 'string' && COMPANION_IDS.includes(value.starterCompanionId)
      ? value.starterCompanionId
      : undefined
  const requestedActiveId =
    typeof value.activeCompanionId === 'string' && COMPANION_IDS.includes(value.activeCompanionId)
      ? value.activeCompanionId
      : STARTER_COMPANION_ID
  const activeCompanionId = companions[requestedActiveId]?.owned
    ? requestedActiveId
    : (starterCompanionId ?? STARTER_COMPANION_ID)

  return {
    activeCompanionId,
    companions,
    dailyAccess:
      value.dailyAccess && typeof value.dailyAccess === 'object'
        ? value.dailyAccess
        : createDefaultStoreState().dailyAccess,
    recentOpenings: Array.isArray(value.recentOpenings) ? value.recentOpenings : [],
    starterCompanionId,
    starterSelected:
      typeof value.starterSelected === 'boolean'
        ? value.starterSelected
        : Boolean(starterCompanionId),
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : undefined
  }
}

function getStorePath(dataDir) {
  return path.join(dataDir, 'companion-store.json')
}

async function writeJsonAtomic(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true })
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`

  await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  await rename(tempPath, filePath)
}

export async function readCompanionStoreState(dataDir) {
  try {
    const file = await readFile(getStorePath(dataDir), 'utf8')
    return normalizeStoreState(JSON.parse(file))
  } catch (error) {
    if (error && error.code === 'ENOENT') return createDefaultStoreState()
    if (error instanceof SyntaxError) return createDefaultStoreState()
    throw error
  }
}

export async function writeCompanionStoreState(dataDir, state) {
  await writeJsonAtomic(getStorePath(dataDir), state)
}

export function createCompanionProgressSnapshot(
  progress,
  storeState,
  companionId = storeState.activeCompanionId
) {
  const safeCompanionId = COMPANION_IDS.includes(companionId) ? companionId : STARTER_COMPANION_ID
  const entry = storeState.companions[safeCompanionId] ?? createDefaultCollectionEntry()
  const xpForNextLevel = getXpRequiredForLevel(entry.level)

  return {
    currentXp: entry.currentXp,
    level: entry.level,
    maxLevel: MAX_COMPANION_LEVEL,
    monsterPoints:
      typeof progress.monsterPoints === 'number' && Number.isFinite(progress.monsterPoints)
        ? Math.max(0, Math.floor(progress.monsterPoints))
        : 0,
    name: getCompanionName(safeCompanionId),
    progressRatio:
      entry.level >= MAX_COMPANION_LEVEL || xpForNextLevel <= 0
        ? 1
        : entry.currentXp / xpForNextLevel,
    recentAwards: Array.isArray(progress.recentAwards) ? progress.recentAwards : [],
    totalXp: entry.totalXp,
    updatedAt: entry.updatedAt ?? progress.updatedAt,
    xpForNextLevel
  }
}

export async function createActiveCompanionProgressSnapshot(dataDir, progress) {
  const storeState = await readCompanionStoreState(dataDir)

  return createCompanionProgressSnapshot(progress, storeState)
}

function resolveXpCompanionId(storeState) {
  if (storeState.companions[storeState.activeCompanionId]?.owned) {
    return storeState.activeCompanionId
  }

  if (
    storeState.starterCompanionId &&
    storeState.companions[storeState.starterCompanionId]?.owned
  ) {
    return storeState.starterCompanionId
  }

  return storeState.activeCompanionId || STARTER_COMPANION_ID
}

function addXpToCollectionEntry(entry, xp, updatedAt) {
  const safeXp = Math.max(0, Math.floor(xp))
  let nextLevel = entry.level
  let nextCurrentXp = entry.currentXp + safeXp
  let nextXpForLevel = getXpRequiredForLevel(nextLevel)
  let monsterPointsEarned = 0

  while (nextLevel < MAX_COMPANION_LEVEL && nextCurrentXp >= nextXpForLevel) {
    nextCurrentXp -= nextXpForLevel
    nextLevel += 1
    monsterPointsEarned += getMonsterPointsForReachedLevel(nextLevel)
    nextXpForLevel = getXpRequiredForLevel(nextLevel)
  }

  if (nextLevel >= MAX_COMPANION_LEVEL) {
    nextCurrentXp = 0
  }

  return {
    entry: {
      ...entry,
      currentXp: nextCurrentXp,
      level: nextLevel,
      owned: true,
      totalXp: entry.totalXp + safeXp,
      unlockedAt: entry.unlockedAt ?? updatedAt,
      updatedAt
    },
    monsterPointsEarned
  }
}

export async function applyXpToActiveCompanion(dataDir, progress, xp, updatedAt) {
  const storeState = await readCompanionStoreState(dataDir)
  const companionId = resolveXpCompanionId(storeState)
  const currentEntry = storeState.companions[companionId] ?? createDefaultCollectionEntry()
  const xpResult = addXpToCollectionEntry(currentEntry, xp, updatedAt)
  const nextStoreState = {
    ...storeState,
    activeCompanionId: companionId,
    companions: {
      ...storeState.companions,
      [companionId]: xpResult.entry
    },
    updatedAt
  }
  const nextProgress = {
    ...progress,
    monsterPoints: progress.monsterPoints + xpResult.monsterPointsEarned,
    updatedAt
  }

  await writeCompanionStoreState(dataDir, nextStoreState)

  return {
    companionId,
    progress: nextProgress,
    storeState: nextStoreState
  }
}
