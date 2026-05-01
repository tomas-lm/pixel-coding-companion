#!/usr/bin/env node
/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { createHash, randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import { appendFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

const MAX_MESSAGES = 80
const CLI_STATES = ['idle', 'working', 'done', 'error', 'waiting_input']
const COMPANION_EVENT_TYPES = ['started', 'finished', 'blocked', 'failed', 'needs_input', 'note']
const COMPANION_ID = 'ghou'
const COMPANION_NAME = 'Ghou'
const COMPANION_PROFILE = {
  id: COMPANION_ID,
  name: COMPANION_NAME,
  archetype: 'pixel ghost coding companion',
  personality: {
    tone: 'calm, observant, useful, lightly playful',
    humor: 'subtle and occasional; never at the expense of clarity',
    responseLength: 'short by default, with details only when useful',
    technicalStyle: 'practical and specific, avoiding audit-log phrasing',
    errorStyle: 'clear and steady, focused on what failed and the next useful step',
    successStyle: 'warm but concise, acknowledging progress without over-celebrating'
  }
}
const MAX_COMPANION_LEVEL = 100
const BASE_NEXT_LEVEL_XP = 120
const LEVEL_XP_GROWTH = 1.13
const ACTIVE_TURN_TIMEOUT_MS = 4 * 60 * 60 * 1000
const DAILY_XP_CAP = 500
const MAX_TURN_XP = 36
const MAX_RECENT_AWARDS = 160
const DUPLICATE_WINDOW_MS = 15 * 60 * 1000
const FALLBACK_FINAL_SUPPRESSION_MS = 2 * 60 * 1000
const FINAL_XP_BONUS = {
  done: 8,
  error: 4,
  waiting_input: 6
}
const execFileAsync = promisify(execFile)

function getDefaultDataDir() {
  if (process.env.PIXEL_COMPANION_DATA_DIR) return process.env.PIXEL_COMPANION_DATA_DIR
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library/Application Support/pixel-coding-companion')
  }
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA ?? os.homedir(), 'pixel-coding-companion')
  }

  return path.join(
    process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config'),
    'pixel-coding-companion'
  )
}

const dataDir = getDefaultDataDir()
const statePath = path.join(dataDir, 'companion-state.json')
const eventsPath = path.join(dataDir, 'companion-events.jsonl')
const progressPath = path.join(dataDir, 'companion-progress.json')
const workspacesPath = path.join(dataDir, 'workspaces.json')
const terminalContextRegistryPath = path.join(dataDir, 'terminal-contexts', 'registry.json')

function getXpRequiredForLevel(level) {
  const safeLevel = Math.min(Math.max(Math.floor(level), 0), MAX_COMPANION_LEVEL)

  return Math.floor(BASE_NEXT_LEVEL_XP * Math.pow(LEVEL_XP_GROWTH, safeLevel))
}

function createDefaultState() {
  return {
    currentState: 'idle',
    messages: []
  }
}

function createDefaultProgress() {
  const xpForNextLevel = getXpRequiredForLevel(0)

  return {
    activeTurns: {},
    currentXp: 0,
    level: 0,
    maxLevel: MAX_COMPANION_LEVEL,
    name: COMPANION_NAME,
    progressRatio: 0,
    recentAwards: [],
    totalXp: 0,
    xpForNextLevel
  }
}

function isValidState(value) {
  return CLI_STATES.includes(value)
}

function isValidCompanionEventType(value) {
  return COMPANION_EVENT_TYPES.includes(value)
}

function getDefaultEventType(cliState) {
  if (cliState === 'working') return 'started'
  if (cliState === 'done') return 'finished'
  if (cliState === 'error') return 'failed'
  if (cliState === 'waiting_input') return 'needs_input'
  return 'note'
}

function getCompanionVoiceGuidance() {
  const { personality } = COMPANION_PROFILE

  return [
    `${COMPANION_PROFILE.name} is a ${COMPANION_PROFILE.archetype}.`,
    `Tone: ${personality.tone}.`,
    `Humor: ${personality.humor}.`,
    `Length: ${personality.responseLength}.`,
    `Technical style: ${personality.technicalStyle}.`,
    'Always match the user language and communication style without assuming a specific locale.',
    'Speak to the user naturally; do not mention MCP, tool calls, schemas, or internal reporting unless the user is debugging Pixel Companion.'
  ].join(' ')
}

function normalizeKey(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function isHexColor(value) {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
}

function truncate(value, maxLength) {
  const text = String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  if (text.length <= maxLength) return text

  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`
}

function readEnvContext() {
  return {
    contextSource: 'env',
    cwd: process.env.PIXEL_COMPANION_CWD,
    projectColor: process.env.PIXEL_COMPANION_PROJECT_COLOR,
    projectId: process.env.PIXEL_COMPANION_PROJECT_ID,
    projectName: process.env.PIXEL_COMPANION_PROJECT_NAME,
    sessionId: process.env.PIXEL_COMPANION_SESSION_ID,
    terminalId: process.env.PIXEL_COMPANION_TERMINAL_ID,
    terminalName: process.env.PIXEL_COMPANION_TERMINAL_NAME
  }
}

async function readContextFile() {
  const contextFile = process.env.PIXEL_COMPANION_CONTEXT_FILE
  if (!contextFile) return {}

  try {
    const file = await readFile(contextFile, 'utf8')
    return {
      contextSource: 'context_file',
      ...JSON.parse(file)
    }
  } catch (error) {
    if (error && error.code === 'ENOENT') return {}
    throw error
  }
}

async function readTerminalContextRegistry() {
  try {
    const file = await readFile(terminalContextRegistryPath, 'utf8')
    const registry = JSON.parse(file)
    return Array.isArray(registry) ? registry : []
  } catch (error) {
    if (error && error.code === 'ENOENT') return []
    if (error instanceof SyntaxError) return []
    throw error
  }
}

async function getParentPid(pid) {
  if (process.platform === 'win32') return null

  try {
    const { stdout } = await execFileAsync('ps', ['-o', 'ppid=', '-p', String(pid)])
    const parentPid = Number(stdout.trim())
    return Number.isFinite(parentPid) && parentPid > 0 ? parentPid : null
  } catch {
    return null
  }
}

async function getAncestorPids(pid) {
  const ancestors = new Set()
  let currentPid = pid

  for (let depth = 0; depth < 40 && currentPid && !ancestors.has(currentPid); depth += 1) {
    ancestors.add(currentPid)
    currentPid = await getParentPid(currentPid)
  }

  return ancestors
}

async function readProcessTreeContext() {
  const registry = await readTerminalContextRegistry()
  if (registry.length === 0) return {}

  const ancestors = await getAncestorPids(process.pid)
  const context = registry.find((entry) => ancestors.has(entry.shellPid))
  if (!context) return {}

  return {
    contextSource: 'process_tree',
    ...context
  }
}

async function readBoundContext() {
  return {
    ...readEnvContext(),
    ...(await readContextFile()),
    ...(await readProcessTreeContext())
  }
}

function normalizeMessage(message) {
  if (!message || typeof message !== 'object') return null
  if (typeof message.id !== 'string') return null
  if (typeof message.createdAt !== 'string') return null
  if (typeof message.title !== 'string') return null
  if (typeof message.summary !== 'string') return null

  return {
    id: message.id,
    agentName: typeof message.agentName === 'string' ? message.agentName : undefined,
    cliState: isValidState(message.cliState) ? message.cliState : 'idle',
    companionId: typeof message.companionId === 'string' ? message.companionId : COMPANION_ID,
    companionName:
      typeof message.companionName === 'string' ? message.companionName : COMPANION_NAME,
    contextSource: typeof message.contextSource === 'string' ? message.contextSource : undefined,
    createdAt: message.createdAt,
    cwd: typeof message.cwd === 'string' ? message.cwd : undefined,
    details: typeof message.details === 'string' ? message.details : undefined,
    eventType: isValidCompanionEventType(message.eventType)
      ? message.eventType
      : getDefaultEventType(message.cliState),
    projectId: typeof message.projectId === 'string' ? message.projectId : undefined,
    projectColor: typeof message.projectColor === 'string' ? message.projectColor : undefined,
    projectName: typeof message.projectName === 'string' ? message.projectName : undefined,
    sessionName: typeof message.sessionName === 'string' ? message.sessionName : undefined,
    terminalId: typeof message.terminalId === 'string' ? message.terminalId : undefined,
    terminalSessionId:
      typeof message.terminalSessionId === 'string' ? message.terminalSessionId : undefined,
    source: message.source === 'app' ? 'app' : 'mcp',
    summary: message.summary,
    title: message.title
  }
}

function normalizeState(state) {
  if (!state || typeof state !== 'object') return createDefaultState()

  const messages = Array.isArray(state.messages)
    ? state.messages.map(normalizeMessage).filter(Boolean)
    : []

  return {
    currentState: isValidState(state.currentState) ? state.currentState : 'idle',
    messages: messages.slice(-MAX_MESSAGES),
    updatedAt: typeof state.updatedAt === 'string' ? state.updatedAt : undefined
  }
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

async function readState() {
  try {
    const file = await readFile(statePath, 'utf8')
    return normalizeState(JSON.parse(file))
  } catch (error) {
    if (error && error.code === 'ENOENT') return createDefaultState()
    if (error instanceof SyntaxError) return createDefaultState()
    throw error
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

async function writeJsonAtomic(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true })
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`

  await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  await rename(tempPath, filePath)
}

async function readWorkspaceConfig() {
  try {
    const file = await readFile(workspacesPath, 'utf8')
    const config = JSON.parse(file)

    return {
      projects: Array.isArray(config.projects) ? config.projects : [],
      terminalConfigs: Array.isArray(config.terminalConfigs) ? config.terminalConfigs : []
    }
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return {
        projects: [],
        terminalConfigs: []
      }
    }

    throw error
  }
}

function getProjectById(projects, projectId) {
  return projects.find((project) => typeof project.id === 'string' && project.id === projectId)
}

function getProjectByName(projects, projectName) {
  const target = normalizeKey(projectName)
  if (!target) return null

  return (
    projects.find((project) => normalizeKey(project.name) === target) ??
    projects.find((project) => {
      const projectKey = normalizeKey(project.name)
      return projectKey && (projectKey.includes(target) || target.includes(projectKey))
    }) ??
    null
  )
}

function getProjectByTerminalSession(projects, terminalConfigs, sessionName) {
  const target = normalizeKey(sessionName)
  if (!target) return null

  const terminal =
    terminalConfigs.find((config) => normalizeKey(config.name) === target) ??
    terminalConfigs.find((config) => {
      const terminalKey = normalizeKey(config.name)
      return terminalKey && (terminalKey.includes(target) || target.includes(terminalKey))
    })

  return terminal ? getProjectById(projects, terminal.projectId) : null
}

function getProjectByCwd(projects, terminalConfigs, cwd) {
  if (typeof cwd !== 'string' || !cwd.trim()) return null

  const normalizedCwd = path.resolve(cwd)
  const terminal = terminalConfigs
    .filter((config) => typeof config.cwd === 'string' && config.cwd.trim())
    .map((config) => ({
      ...config,
      normalizedConfigCwd: path.resolve(config.cwd)
    }))
    .filter(
      (config) =>
        normalizedCwd === config.normalizedConfigCwd ||
        normalizedCwd.startsWith(`${config.normalizedConfigCwd}${path.sep}`)
    )
    .sort((left, right) => right.normalizedConfigCwd.length - left.normalizedConfigCwd.length)[0]

  return terminal ? getProjectById(projects, terminal.projectId) : null
}

async function resolveProject(input) {
  const boundContext = await readBoundContext()
  if (boundContext.projectId || boundContext.projectName || boundContext.projectColor) {
    return {
      cwd: boundContext.cwd ?? input.cwd,
      projectColor: isHexColor(boundContext.projectColor)
        ? boundContext.projectColor
        : isHexColor(input.projectColor)
          ? input.projectColor
          : undefined,
      projectId: boundContext.projectId,
      projectName: boundContext.projectName ?? input.projectName,
      sessionName: boundContext.terminalName ?? input.sessionName,
      terminalId: boundContext.terminalId,
      terminalSessionId: boundContext.sessionId,
      contextSource: boundContext.contextSource
    }
  }

  const { projects, terminalConfigs } = await readWorkspaceConfig()
  const project =
    getProjectById(projects, input.projectId) ??
    getProjectByCwd(projects, terminalConfigs, input.cwd) ??
    getProjectByTerminalSession(projects, terminalConfigs, input.sessionName) ??
    getProjectByTerminalSession(projects, terminalConfigs, input.title) ??
    getProjectByName(projects, input.projectName)

  if (!project) {
    return {
      cwd: input.cwd,
      contextSource: 'input',
      projectColor: isHexColor(input.projectColor) ? input.projectColor : undefined,
      projectName: input.projectName
    }
  }

  return {
    cwd: input.cwd,
    contextSource: 'workspace',
    projectColor: isHexColor(project.color) ? project.color : undefined,
    projectId: project.id,
    projectName: project.name
  }
}

async function writeMessage(message) {
  await mkdir(dataDir, { recursive: true })

  const currentState = await readState()
  const nextState = {
    currentState: message.cliState,
    messages: [...currentState.messages, message].slice(-MAX_MESSAGES),
    updatedAt: message.createdAt
  }

  await writeJsonAtomic(statePath, nextState)
  await appendFile(eventsPath, `${JSON.stringify(message)}\n`, 'utf8')

  return nextState
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

function getDailyAwardedXp(recentAwards, message) {
  const day = message.createdAt.slice(0, 10)

  return recentAwards
    .filter((award) => award.createdAt.slice(0, 10) === day)
    .reduce((total, award) => total + award.xp, 0)
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

function addXp(progress, xp) {
  let nextLevel = progress.level
  let nextCurrentXp = progress.currentXp + xp
  let nextXpForLevel = getXpRequiredForLevel(nextLevel)

  while (nextLevel < MAX_COMPANION_LEVEL && nextCurrentXp >= nextXpForLevel) {
    nextCurrentXp -= nextXpForLevel
    nextLevel += 1
    nextXpForLevel = getXpRequiredForLevel(nextLevel)
  }

  if (nextLevel >= MAX_COMPANION_LEVEL) {
    nextCurrentXp = 0
  }

  return {
    ...progress,
    currentXp: nextCurrentXp,
    level: nextLevel,
    progressRatio:
      nextLevel >= MAX_COMPANION_LEVEL || nextXpForLevel <= 0 ? 1 : nextCurrentXp / nextXpForLevel,
    totalXp: progress.totalXp + xp,
    xpForNextLevel: nextXpForLevel
  }
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
      progress
    }
  }

  if (message.cliState === 'idle') {
    delete progress.activeTurns[turnKey]
    progress.updatedAt = message.createdAt
    await writeJsonAtomic(progressPath, progress)

    return {
      award: null,
      progress
    }
  }

  if (!['done', 'error', 'waiting_input'].includes(message.cliState)) {
    return {
      award: null,
      progress
    }
  }

  if (progress.recentAwards.some((award) => award.messageId === message.id)) {
    return {
      award: null,
      progress
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
      progress
    }
  }

  const startedAtMs = activeTurn ? Date.parse(activeTurn.startedAt) : null
  const hasWorking = Boolean(activeTurn && Number.isFinite(startedAtMs))
  const durationMs = hasWorking ? Math.max(0, safeNowMs - startedAtMs) : 0
  const duplicate = isDuplicateAward(progress.recentAwards, turnKey, signature, safeNowMs)
  const dailyRemainingXp = Math.max(
    0,
    DAILY_XP_CAP - getDailyAwardedXp(progress.recentAwards, message)
  )
  const calculatedAward = calculateTurnXp({
    duplicate,
    durationMs,
    hasWorking,
    message
  })
  const award = {
    createdAt: message.createdAt,
    messageId: message.id,
    reason: dailyRemainingXp <= 0 ? 'daily_cap' : calculatedAward.reason,
    signature,
    turnKey,
    xp: Math.min(calculatedAward.xp, dailyRemainingXp)
  }
  const nextProgress = addXp(progress, award.xp)

  delete nextProgress.activeTurns[turnKey]
  nextProgress.recentAwards = [...nextProgress.recentAwards, award].slice(-MAX_RECENT_AWARDS)
  nextProgress.updatedAt = message.createdAt

  await writeJsonAtomic(progressPath, nextProgress)

  return {
    award,
    progress: nextProgress
  }
}

async function createMessage(input) {
  const now = new Date().toISOString()
  const resolvedProject = await resolveProject(input)

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
  const context = await readBoundContext()
  const terminalName = getSessionLabel(context, hookInput)
  const projectName = getProjectLabel(context)
  const additionalContext = [
    '[Pixel Companion setup]',
    'This is startup context, not a user task.',
    `You are running inside Pixel Companion terminal "${terminalName}" for "${projectName}".`,
    `Active companion: ${COMPANION_NAME}. ${getCompanionVoiceGuidance()}`,
    'Use the pixel-companion MCP companion_report tool when meaningful work starts, finishes, fails, or needs user input.',
    'If context was reset or cleared, use companion_get_profile to recover the active companion personality and reporting contract.',
    'Write Ghou messages as natural user-facing speech. Match the user language and communication style.',
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
  const context = await readBoundContext()
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
  const context = await readBoundContext()
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
