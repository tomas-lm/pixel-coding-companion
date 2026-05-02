#!/usr/bin/env node
/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { createHash, randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import {
  getDefaultEventType,
  isValidCompanionEventType,
  writeBridgeMessage
} from './companion-bridge-state.mjs'
import { createCompanionDataPaths, getDefaultDataDir } from './companion-data-dir.mjs'
import { writeJsonAtomic } from './companion-json-store.mjs'
import { readBoundContext, resolveProject } from './companion-project-context.mjs'
import {
  getCompanionVoiceGuidance as buildCompanionVoiceGuidance,
  readActiveCompanionProfile
} from './companion-profile.mjs'
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
const dataDir = getDefaultDataDir()
const {
  eventsPath,
  externalTerminalRegistryPath,
  progressPath,
  statePath,
  terminalContextRegistryPath,
  workspacesPath
} = createCompanionDataPaths(dataDir)
const COMPANION_PROFILE = await readActiveCompanionProfile(dataDir)
const COMPANION_ID = COMPANION_PROFILE.id
const COMPANION_NAME = COMPANION_PROFILE.name
const projectContextOptions = {
  externalTerminalRegistryPath,
  terminalContextRegistryPath,
  workspacesPath
}

function getXpRequiredForLevel(level) {
  const safeLevel = Math.min(Math.max(Math.floor(level), 0), MAX_COMPANION_LEVEL)

  return Math.floor(BASE_NEXT_LEVEL_XP * Math.pow(LEVEL_XP_GROWTH, safeLevel))
}

function createDefaultProgress() {
  const xpForNextLevel = getXpRequiredForLevel(0)

  return {
    activeTurns: {},
    currentXp: 0,
    level: 0,
    maxLevel: MAX_COMPANION_LEVEL,
    monsterPoints: 0,
    name: COMPANION_NAME,
    progressRatio: 0,
    recentAwards: [],
    totalXp: 0,
    xpForNextLevel
  }
}

function getCompanionVoiceGuidance() {
  return buildCompanionVoiceGuidance(COMPANION_PROFILE)
}

function truncate(value, maxLength) {
  const text = String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  if (text.length <= maxLength) return text

  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`
}

function normalizeActiveTurn(value) {
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

function normalizeAward(value) {
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

function normalizeProgress(progress) {
  if (!progress || typeof progress !== 'object') return createDefaultProgress()

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
        : COMPANION_NAME,
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

async function readProgress() {
  try {
    const file = await readFile(progressPath, 'utf8')
    return normalizeProgress(JSON.parse(file))
  } catch (error) {
    if (error && error.code === 'ENOENT') return createDefaultProgress()
    if (error instanceof SyntaxError) return createDefaultProgress()
    throw error
  }
}

async function writeMessage(message) {
  return writeBridgeMessage({
    dataDir,
    eventsPath,
    message,
    statePath,
    stateOptions: {
      companionId: COMPANION_ID,
      companionName: COMPANION_NAME,
      swallowSyntax: true
    }
  })
}

function getTurnKey(message) {
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

function getMessageSignature(message) {
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

function pruneActiveTurns(activeTurns, nowMs) {
  return Object.fromEntries(
    Object.entries(activeTurns).filter(([, turn]) => {
      const startedAtMs = Date.parse(turn.startedAt)
      return Number.isFinite(startedAtMs) && nowMs - startedAtMs <= ACTIVE_TURN_TIMEOUT_MS
    })
  )
}

function isDuplicateAward(recentAwards, turnKey, signature, nowMs) {
  return recentAwards.some((award) => {
    if (award.turnKey !== turnKey || award.signature !== signature) return false

    const awardMs = Date.parse(award.createdAt)
    return Number.isFinite(awardMs) && nowMs - awardMs <= DUPLICATE_WINDOW_MS
  })
}

function hasRecentFinalAward(recentAwards, turnKey, nowMs) {
  return recentAwards.some((award) => {
    if (award.turnKey !== turnKey || award.xp <= 0) return false

    const awardMs = Date.parse(award.createdAt)
    return Number.isFinite(awardMs) && nowMs - awardMs <= FALLBACK_FINAL_SUPPRESSION_MS
  })
}

function calculateTurnXp({ duplicate, durationMs, hasWorking, message }) {
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

async function updateCompanionProgress(message, options = {}) {
  const progress = await readProgress()
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
    await writeJsonAtomic(progressPath, progress)

    return {
      award: null,
      progress: await createActiveCompanionProgressSnapshot(dataDir, progress)
    }
  }

  if (message.cliState === 'idle') {
    delete progress.activeTurns[turnKey]
    progress.updatedAt = message.createdAt
    await writeJsonAtomic(progressPath, progress)

    return {
      award: null,
      progress: await createActiveCompanionProgressSnapshot(dataDir, progress)
    }
  }

  if (!['done', 'error', 'waiting_input'].includes(message.cliState)) {
    return {
      award: null,
      progress: await createActiveCompanionProgressSnapshot(dataDir, progress)
    }
  }

  if (progress.recentAwards.some((award) => award.messageId === message.id)) {
    return {
      award: null,
      progress: await createActiveCompanionProgressSnapshot(dataDir, progress)
    }
  }

  const activeTurn = progress.activeTurns[turnKey]

  if (
    options.suppressFallbackFinal &&
    !activeTurn &&
    hasRecentFinalAward(progress.recentAwards, turnKey, safeNowMs)
  ) {
    progress.updatedAt = message.createdAt
    await writeJsonAtomic(progressPath, progress)

    return {
      award: null,
      progress: await createActiveCompanionProgressSnapshot(dataDir, progress)
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
    dataDir,
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

  await writeJsonAtomic(progressPath, nextProgress)

  return {
    award,
    progress: await createActiveCompanionProgressSnapshot(dataDir, nextProgress)
  }
}

async function createMessage(input) {
  const now = new Date().toISOString()
  const resolvedProject = await resolveProject(input, projectContextOptions)

  return {
    id: randomUUID(),
    agentName: input.agentName,
    cliState: input.cliState,
    codexSessionId: input.codexSessionId,
    codexTurnId: input.codexTurnId,
    companionId: COMPANION_PROFILE.id,
    companionName: COMPANION_PROFILE.name,
    contextSource: resolvedProject.contextSource,
    createdAt: now,
    cwd: resolvedProject.cwd ?? input.cwd,
    details: input.details,
    eventType: isValidCompanionEventType(input.eventType)
      ? input.eventType
      : getDefaultEventType(input.cliState),
    hookEventName: input.hookEventName,
    projectColor: resolvedProject.projectColor,
    projectId: resolvedProject.projectId,
    projectName: resolvedProject.projectName,
    sessionName: resolvedProject.sessionName ?? input.sessionName,
    terminalId: resolvedProject.terminalId,
    terminalSessionId: resolvedProject.terminalSessionId,
    source: 'app',
    summary: input.summary,
    title:
      input.title ??
      resolvedProject.sessionName ??
      input.sessionName ??
      input.agentName ??
      'CLI update'
  }
}

async function shouldSuppressFallbackFinalMessage(message) {
  const progress = await readProgress()
  const nowMs = Date.parse(message.createdAt)
  const safeNowMs = Number.isFinite(nowMs) ? nowMs : Date.now()
  const turnKey = getTurnKey(message)

  return (
    !progress.activeTurns[turnKey] && hasRecentFinalAward(progress.recentAwards, turnKey, safeNowMs)
  )
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let input = ''

    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (chunk) => {
      input += chunk
    })
    process.stdin.on('error', reject)
    process.stdin.on('end', () => resolve(input))
  })
}

async function readHookInput() {
  const rawInput = await readStdin()
  if (!rawInput.trim()) return {}

  return JSON.parse(rawInput)
}

function getSessionLabel(context, hookInput) {
  return (
    context.sessionName ??
    context.terminalName ??
    process.env.PIXEL_COMPANION_TERMINAL_NAME ??
    hookInput.cwd ??
    'this terminal'
  )
}

function getProjectLabel(context) {
  return context.projectName ?? process.env.PIXEL_COMPANION_PROJECT_NAME ?? 'this project'
}

function isPixelHookEnabled() {
  return process.env.PIXEL_COMPANION_START_WITH_PIXEL === '1'
}

async function buildSessionStartResponse(hookInput) {
  const context = await readBoundContext(projectContextOptions)
  const terminalName = getSessionLabel(context, hookInput)
  const projectName = getProjectLabel(context)
  const additionalContext = [
    '[Pixel Companion setup]',
    'This is startup context, not a user task.',
    `You are running inside Pixel Companion terminal "${terminalName}" for "${projectName}".`,
    `Active companion: ${COMPANION_NAME}. ${getCompanionVoiceGuidance()}`,
    'Use the pixel-companion MCP companion_report tool when meaningful work starts, finishes, fails, or needs user input.',
    'If context was reset or cleared, use companion_get_profile to recover the active companion personality and reporting contract.',
    `Write ${COMPANION_NAME} messages as natural user-facing speech. Match the user language and communication style.`,
    'Do not mention MCP, tool calls, schemas, hooks, or internal reporting unless the user is debugging Pixel Companion.'
  ].join(' ')

  return {
    continue: true,
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext
    }
  }
}

async function handleUserPromptSubmit(hookInput) {
  const context = await readBoundContext(projectContextOptions)
  const sessionLabel = getSessionLabel(context, hookInput)
  const promptPreview = truncate(hookInput.prompt, 280)
  const message = await createMessage({
    agentName: 'Codex',
    cliState: 'working',
    codexSessionId: hookInput.session_id,
    codexTurnId: hookInput.turn_id,
    cwd: hookInput.cwd,
    details: promptPreview ? `Prompt: ${promptPreview}` : undefined,
    eventType: 'started',
    hookEventName: hookInput.hook_event_name ?? 'UserPromptSubmit',
    projectColor: context.projectColor,
    projectId: context.projectId,
    projectName: context.projectName,
    sessionName: context.terminalName,
    summary: `Codex started working in ${sessionLabel}.`,
    title: sessionLabel
  })

  await writeMessage(message)
  await updateCompanionProgress(message)

  return {
    continue: true,
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: [
        `Pixel Companion is watching this turn in "${sessionLabel}".`,
        `When work finishes, speak through ${COMPANION_NAME} with companion_report using natural user-facing language.`,
        'Do not mention hooks or internal reporting unless the user is debugging Pixel Companion.'
      ].join(' ')
    }
  }
}

async function handleStop(hookInput) {
  const context = await readBoundContext(projectContextOptions)
  const sessionLabel = getSessionLabel(context, hookInput)
  const assistantMessage = truncate(hookInput.last_assistant_message, 420)
  const summary = assistantMessage
    ? `Codex finished in ${sessionLabel}. ${assistantMessage}`
    : `Codex finished a turn in ${sessionLabel}.`
  const message = await createMessage({
    agentName: 'Codex',
    cliState: 'done',
    codexSessionId: hookInput.session_id,
    codexTurnId: hookInput.turn_id,
    cwd: hookInput.cwd,
    details: assistantMessage,
    eventType: 'finished',
    hookEventName: hookInput.hook_event_name ?? 'Stop',
    projectColor: context.projectColor,
    projectId: context.projectId,
    projectName: context.projectName,
    sessionName: context.terminalName,
    summary,
    title: sessionLabel
  })

  if (await shouldSuppressFallbackFinalMessage(message)) {
    return {
      continue: true
    }
  }

  await writeMessage(message)
  await updateCompanionProgress(message, { suppressFallbackFinal: true })

  return {
    continue: true
  }
}

async function handleEvent(command) {
  const hookInput = await readHookInput()

  if (!isPixelHookEnabled()) {
    return {
      continue: true
    }
  }

  if (command === 'codex-session-start') return buildSessionStartResponse(hookInput)
  if (command === 'codex-user-prompt-submit') return handleUserPromptSubmit(hookInput)
  if (command === 'codex-stop') return handleStop(hookInput)

  return {
    continue: true,
    systemMessage: `Pixel Companion hook ignored unknown command: ${command}`
  }
}

try {
  const command = process.argv[2] ?? ''
  const response = await handleEvent(command)

  process.stdout.write(`${JSON.stringify(response)}\n`)
} catch (error) {
  process.stderr.write(
    `Pixel Companion hook failed: ${error instanceof Error ? error.stack || error.message : String(error)}\n`
  )
  process.stdout.write('{"continue":true}\n')
}
