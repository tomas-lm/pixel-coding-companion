/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { writeJsonAtomic } from './companion-json-store.mjs'
import {
  applyXpToActiveCompanion,
  createActiveCompanionProgressSnapshot
} from './companion-store-progress.mjs'

const MAX_COMPANION_LEVEL = 100
const BASE_NEXT_LEVEL_XP = 120
const LEVEL_XP_GROWTH = 1.13
const ACTIVE_TURN_TIMEOUT_MS = 4 * 60 * 60 * 1000
const MAX_TURN_XP = 36
const MAX_RECENT_AWARDS = 160
const DUPLICATE_WINDOW_MS = 15 * 60 * 1000
const FALLBACK_FINAL_SUPPRESSION_MS = 2 * 60 * 1000
const FINAL_XP_BONUS = {
  done: 8,
  error: 4,
  waiting_input: 6
}

export function getXpRequiredForLevel(level) {
  const safeLevel = Math.min(Math.max(Math.floor(level), 0), MAX_COMPANION_LEVEL)

  return Math.floor(BASE_NEXT_LEVEL_XP * Math.pow(LEVEL_XP_GROWTH, safeLevel))
}

export function createDefaultProgress(companionName) {
  const xpForNextLevel = getXpRequiredForLevel(0)

  return {
    activeTurns: {},
    currentXp: 0,
    level: 0,
    maxLevel: MAX_COMPANION_LEVEL,
    monsterPoints: 0,
    name: companionName,
    progressRatio: 0,
    recentAwards: [],
    totalXp: 0,
    xpForNextLevel
  }
}

export function normalizeActiveTurn(value) {
  if (!value || typeof value !== 'object') return null
  if (typeof value.startedAt !== 'string') return null

  return {
    agentName: typeof value.agentName === 'string' ? value.agentName : undefined,
    messageId: typeof value.messageId === 'string' ? value.messageId : undefined,
    projectId: typeof value.projectId === 'string' ? value.projectId : undefined,
    projectName: typeof value.projectName === 'string' ? value.projectName : undefined,
    sessionName: typeof value.sessionName === 'string' ? value.sessionName : undefined,
    signature: typeof value.signature === 'string' ? value.signature : undefined,
    startedAt: value.startedAt,
    terminalId: typeof value.terminalId === 'string' ? value.terminalId : undefined,
    terminalSessionId:
      typeof value.terminalSessionId === 'string' ? value.terminalSessionId : undefined
  }
}

export function normalizeAward(value) {
  if (!value || typeof value !== 'object') return null
  if (typeof value.createdAt !== 'string') return null
  if (typeof value.messageId !== 'string') return null

  return {
    createdAt: value.createdAt,
    companionId: typeof value.companionId === 'string' ? value.companionId : undefined,
    messageId: value.messageId,
    reason: typeof value.reason === 'string' ? value.reason : undefined,
    signature: typeof value.signature === 'string' ? value.signature : undefined,
    turnKey: typeof value.turnKey === 'string' ? value.turnKey : undefined,
    xp: typeof value.xp === 'number' && Number.isFinite(value.xp) ? Math.max(0, value.xp) : 0
  }
}

export function normalizeProgress(progress, companionName) {
  if (!progress || typeof progress !== 'object') return createDefaultProgress(companionName)

  const level =
    typeof progress.level === 'number' && Number.isFinite(progress.level)
      ? Math.min(Math.max(Math.floor(progress.level), 0), MAX_COMPANION_LEVEL)
      : 0
  const xpForNextLevel = getXpRequiredForLevel(level)
  const currentXp =
    typeof progress.currentXp === 'number' && Number.isFinite(progress.currentXp)
      ? Math.min(Math.max(Math.floor(progress.currentXp), 0), xpForNextLevel)
      : 0
  const activeTurns =
    progress.activeTurns && typeof progress.activeTurns === 'object'
      ? Object.fromEntries(
          Object.entries(progress.activeTurns)
            .map(([key, turn]) => [key, normalizeActiveTurn(turn)])
            .filter((entry) => entry[1])
        )
      : {}
  const recentAwards = Array.isArray(progress.recentAwards)
    ? progress.recentAwards.map(normalizeAward).filter(Boolean).slice(-MAX_RECENT_AWARDS)
    : []

  return {
    activeTurns,
    currentXp,
    level,
    maxLevel: MAX_COMPANION_LEVEL,
    monsterPoints:
      typeof progress.monsterPoints === 'number' && Number.isFinite(progress.monsterPoints)
        ? Math.max(0, Math.floor(progress.monsterPoints))
        : 0,
    name:
      typeof progress.name === 'string' && progress.name.trim()
        ? progress.name.trim()
        : companionName,
    progressRatio: xpForNextLevel > 0 ? currentXp / xpForNextLevel : 1,
    recentAwards,
    totalXp:
      typeof progress.totalXp === 'number' && Number.isFinite(progress.totalXp)
        ? Math.max(0, Math.floor(progress.totalXp))
        : currentXp,
    updatedAt: typeof progress.updatedAt === 'string' ? progress.updatedAt : undefined,
    xpForNextLevel
  }
}

export async function readProgress({ companionName, progressPath }) {
  try {
    const file = await readFile(progressPath, 'utf8')
    return normalizeProgress(JSON.parse(file), companionName)
  } catch (error) {
    if (error && error.code === 'ENOENT') return createDefaultProgress(companionName)
    if (error instanceof SyntaxError) return createDefaultProgress(companionName)
    throw error
  }
}

export function getTurnKey(message) {
  return (
    [
      message.terminalSessionId,
      message.terminalId,
      message.projectId,
      message.sessionName,
      message.agentName
    ]
      .filter(Boolean)
      .join('|') || 'unknown-agent-turn'
  )
}

export function getMessageSignature(message) {
  const text = [message.agentName, message.projectId, message.sessionName, message.summary]
    .filter(Boolean)
    .join('|')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

  return createHash('sha256').update(text).digest('hex').slice(0, 16)
}

export function pruneActiveTurns(activeTurns, nowMs) {
  return Object.fromEntries(
    Object.entries(activeTurns).filter(([, turn]) => {
      const startedAtMs = Date.parse(turn.startedAt)
      return Number.isFinite(startedAtMs) && nowMs - startedAtMs <= ACTIVE_TURN_TIMEOUT_MS
    })
  )
}

export function isDuplicateAward(recentAwards, turnKey, signature, nowMs) {
  return recentAwards.some((award) => {
    if (award.turnKey !== turnKey || award.signature !== signature) return false

    const awardMs = Date.parse(award.createdAt)
    return Number.isFinite(awardMs) && nowMs - awardMs <= DUPLICATE_WINDOW_MS
  })
}

export function hasRecentFinalAward(recentAwards, turnKey, nowMs) {
  return recentAwards.some((award) => {
    if (award.turnKey !== turnKey || award.xp <= 0) return false

    const awardMs = Date.parse(award.createdAt)
    return Number.isFinite(awardMs) && nowMs - awardMs <= FALLBACK_FINAL_SUPPRESSION_MS
  })
}

export function calculateTurnXp({ duplicate, durationMs, hasWorking, message }) {
  const finalBonus = FINAL_XP_BONUS[message.cliState] ?? 0
  const durationXp = hasWorking ? Math.min(12, Math.floor(durationMs / 60000) * 2) : 0
  const messageXp = Math.min(
    8,
    Math.floor(`${message.summary ?? ''} ${message.details ?? ''}`.trim().length / 120)
  )
  let xp = 8 + finalBonus + durationXp + messageXp
  let reason = hasWorking ? 'completed_turn' : 'orphan_final_state'

  if (!hasWorking) {
    xp = Math.max(3, Math.floor(xp * 0.45))
  }

  if (duplicate) {
    xp = Math.min(xp, 2)
    reason = 'duplicate_reduced'
  }

  return {
    reason,
    xp: Math.min(xp, MAX_TURN_XP)
  }
}

export async function updateCompanionProgress(message, options) {
  const progress = await readProgress(options)
  const nowMs = Date.parse(message.createdAt)
  const safeNowMs = Number.isFinite(nowMs) ? nowMs : Date.now()
  const turnKey = getTurnKey(message)
  const signature = getMessageSignature(message)

  progress.activeTurns = pruneActiveTurns(progress.activeTurns, safeNowMs)

  if (message.cliState === 'working') {
    progress.activeTurns[turnKey] = {
      agentName: message.agentName,
      messageId: message.id,
      projectId: message.projectId,
      projectName: message.projectName,
      sessionName: message.sessionName,
      signature,
      startedAt: message.createdAt,
      terminalId: message.terminalId,
      terminalSessionId: message.terminalSessionId
    }
    progress.updatedAt = message.createdAt
    await writeJsonAtomic(options.progressPath, progress)

    return {
      award: null,
      progress: await createActiveCompanionProgressSnapshot(options.dataDir, progress)
    }
  }

  if (message.cliState === 'idle') {
    delete progress.activeTurns[turnKey]
    progress.updatedAt = message.createdAt
    await writeJsonAtomic(options.progressPath, progress)

    return {
      award: null,
      progress: await createActiveCompanionProgressSnapshot(options.dataDir, progress)
    }
  }

  if (!['done', 'error', 'waiting_input'].includes(message.cliState)) {
    return {
      award: null,
      progress: await createActiveCompanionProgressSnapshot(options.dataDir, progress)
    }
  }

  if (progress.recentAwards.some((award) => award.messageId === message.id)) {
    return {
      award: null,
      progress: await createActiveCompanionProgressSnapshot(options.dataDir, progress)
    }
  }

  const activeTurn = progress.activeTurns[turnKey]

  if (
    options.suppressFallbackFinal &&
    !activeTurn &&
    hasRecentFinalAward(progress.recentAwards, turnKey, safeNowMs)
  ) {
    progress.updatedAt = message.createdAt
    await writeJsonAtomic(options.progressPath, progress)

    return {
      award: null,
      progress: await createActiveCompanionProgressSnapshot(options.dataDir, progress)
    }
  }

  const startedAtMs = activeTurn ? Date.parse(activeTurn.startedAt) : null
  const hasWorking = Boolean(activeTurn && Number.isFinite(startedAtMs))
  const durationMs = hasWorking ? Math.max(0, safeNowMs - startedAtMs) : 0
  const duplicate = isDuplicateAward(progress.recentAwards, turnKey, signature, safeNowMs)
  const calculatedAward = calculateTurnXp({
    duplicate,
    durationMs,
    hasWorking,
    message
  })
  const xpResult = await applyXpToActiveCompanion(
    options.dataDir,
    progress,
    calculatedAward.xp,
    message.createdAt
  )
  const award = {
    createdAt: message.createdAt,
    companionId: xpResult.companionId,
    messageId: message.id,
    reason: calculatedAward.reason,
    signature,
    turnKey,
    xp: calculatedAward.xp
  }
  const nextProgress = xpResult.progress

  delete nextProgress.activeTurns[turnKey]
  nextProgress.recentAwards = [...nextProgress.recentAwards, award].slice(-MAX_RECENT_AWARDS)
  nextProgress.updatedAt = message.createdAt

  await writeJsonAtomic(options.progressPath, nextProgress)

  return {
    award,
    progress: await createActiveCompanionProgressSnapshot(options.dataDir, nextProgress)
  }
}

export async function shouldSuppressFallbackFinalMessage(message, options) {
  const progress = await readProgress(options)
  const nowMs = Date.parse(message.createdAt)
  const safeNowMs = Number.isFinite(nowMs) ? nowMs : Date.now()
  const turnKey = getTurnKey(message)

  return (
    !progress.activeTurns[turnKey] && hasRecentFinalAward(progress.recentAwards, turnKey, safeNowMs)
  )
}
