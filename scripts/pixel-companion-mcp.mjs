#!/usr/bin/env node
/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { createHash, randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import { appendFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod/v4'

const MAX_MESSAGES = 80
const CLI_STATES = ['idle', 'working', 'done', 'error', 'waiting_input']
const COMPANION_EVENT_TYPES = ['started', 'finished', 'blocked', 'failed', 'needs_input', 'note']

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
const externalTerminalRegistryPath = path.join(dataDir, 'external-terminals.json')
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
const execFileAsync = promisify(execFile)
const MAX_COMPANION_LEVEL = 100
const BASE_NEXT_LEVEL_XP = 120
const LEVEL_XP_GROWTH = 1.13
const ACTIVE_TURN_TIMEOUT_MS = 4 * 60 * 60 * 1000
const DAILY_XP_CAP = 500
const MAX_TURN_XP = 36
const MAX_RECENT_AWARDS = 160
const DUPLICATE_WINDOW_MS = 15 * 60 * 1000
const FINAL_XP_BONUS = {
  done: 8,
  error: 4,
  waiting_input: 6
}
const EXTERNAL_TERMINAL_COLORS = [
  '#ff8bd1',
  '#f97316',
  '#a3e635',
  '#22d3ee',
  '#f43f5e',
  '#e879f9',
  '#facc15',
  '#94a3b8'
]
const COMPANION_REPORT_DESCRIPTION = [
  'Send a user-facing message from the active Pixel Companion about what just happened in this CLI session.',
  `Active companion: ${COMPANION_PROFILE.name}, a ${COMPANION_PROFILE.archetype}. Personality: ${COMPANION_PROFILE.personality.tone}. Humor: ${COMPANION_PROFILE.personality.humor}.`,
  'The summary is displayed directly in the companion terminal, so write it like natural companion speech, not like an audit log or MCP status record.',
  'Match the user language and communication style. Do not assume a specific country, locale, or language.',
  'Keep the main message concise. Mention the concrete result, failure, blocker, or next needed input. Add technical details only when they help the user act.',
  'Do not write phrases like "Task completed:", "Summary:", "Message registered", "Status updated", or "companion_report was called".'
].join(' ')

function createDefaultState() {
  return {
    currentState: 'idle',
    messages: []
  }
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

function isHexColor(value) {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
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

function hasStrongBoundContext(context) {
  return Boolean(
    context.projectId ||
    context.projectName ||
    context.projectColor ||
    context.sessionId ||
    context.terminalId ||
    context.terminalName
  )
}

async function readExternalTerminalRegistry() {
  try {
    const file = await readFile(externalTerminalRegistryPath, 'utf8')
    const registry = JSON.parse(file)
    return Array.isArray(registry) ? registry : []
  } catch (error) {
    if (error && error.code === 'ENOENT') return []
    if (error instanceof SyntaxError) return []
    throw error
  }
}

async function writeExternalTerminalRegistry(registry) {
  await writeJsonAtomic(externalTerminalRegistryPath, registry)
}

async function getExternalTerminalKey(input) {
  const parentPid = await getParentPid(process.pid)
  const cwd = typeof input.cwd === 'string' && input.cwd.trim() ? path.resolve(input.cwd) : ''
  const wrappedCli = process.env.PIXEL_COMPANION_WRAPPED_CLI ?? input.agentName ?? 'external'

  return [wrappedCli, parentPid ?? process.pid, cwd].filter(Boolean).join('|')
}

function getNextExternalTerminalNumber(registry) {
  const usedNumbers = registry
    .map((entry) => {
      const match =
        typeof entry.name === 'string'
          ? entry.name.match(/^(?:Outro terminal|Terminal) (\d+)$/)
          : null
      return match ? Number(match[1]) : 0
    })
    .filter((value) => Number.isFinite(value) && value > 0)

  return Math.max(0, ...usedNumbers) + 1
}

function getExternalTerminalColor(number, projects) {
  const projectColors = new Set(
    projects
      .map((project) => (typeof project.color === 'string' ? project.color.toLowerCase() : ''))
      .filter(Boolean)
  )
  const availableColors = EXTERNAL_TERMINAL_COLORS.filter(
    (color) => !projectColors.has(color.toLowerCase())
  )
  const colors = availableColors.length > 0 ? availableColors : EXTERNAL_TERMINAL_COLORS

  return colors[(number - 1) % colors.length]
}

async function resolveExternalTerminal(input, projects) {
  const registry = await readExternalTerminalRegistry()
  const key = await getExternalTerminalKey(input)
  const now = new Date().toISOString()
  const existingEntry = registry.find((entry) => entry.key === key)
  const nextNumber = existingEntry ? existingEntry.number : getNextExternalTerminalNumber(registry)
  const entry = existingEntry ?? {
    color: getExternalTerminalColor(nextNumber, projects),
    createdAt: now,
    id: `other-terminal-${nextNumber}`,
    key,
    name: `Terminal ${nextNumber}`,
    number: nextNumber
  }
  const nextEntry = {
    ...entry,
    cwd: input.cwd,
    name: `Terminal ${nextNumber}`,
    updatedAt: now
  }
  const nextRegistry = existingEntry
    ? registry.map((candidate) => (candidate.key === key ? nextEntry : candidate))
    : [...registry, nextEntry]

  await writeExternalTerminalRegistry(nextRegistry)

  return {
    cwd: input.cwd,
    contextSource: 'external_terminal',
    projectColor: nextEntry.color,
    projectId: nextEntry.id,
    projectName: nextEntry.name,
    sessionName: nextEntry.name,
    terminalId: nextEntry.id,
    terminalSessionId: nextEntry.id
  }
}

async function resolveProject(input) {
  const boundContext = await readBoundContext()
  if (hasStrongBoundContext(boundContext)) {
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

  const { projects } = await readWorkspaceConfig()
  const project = getProjectById(projects, input.projectId)

  if (!project) {
    return resolveExternalTerminal(input, projects)
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

  await writeFile(statePath, `${JSON.stringify(nextState, null, 2)}\n`, 'utf8')
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

async function updateCompanionProgress(message) {
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

function createReply(message) {
  return `${COMPANION_NAME} > ${message.summary}`
}

async function createMessage(input) {
  const now = new Date().toISOString()
  const resolvedProject = await resolveProject(input)

  return {
    id: randomUUID(),
    agentName: input.agentName,
    cliState: input.cliState,
    companionId: COMPANION_PROFILE.id,
    companionName: COMPANION_PROFILE.name,
    contextSource: resolvedProject.contextSource,
    createdAt: now,
    cwd: resolvedProject.cwd ?? input.cwd,
    details: input.details,
    eventType: isValidCompanionEventType(input.eventType)
      ? input.eventType
      : getDefaultEventType(input.cliState),
    projectColor: resolvedProject.projectColor,
    projectId: resolvedProject.projectId,
    projectName: resolvedProject.projectName,
    sessionName: resolvedProject.sessionName ?? input.sessionName,
    terminalId: resolvedProject.terminalId,
    terminalSessionId: resolvedProject.terminalSessionId,
    source: 'mcp',
    summary: input.summary,
    title:
      input.title ??
      resolvedProject.sessionName ??
      input.sessionName ??
      input.agentName ??
      'CLI update'
  }
}

const server = new McpServer({
  name: 'pixel-companion',
  version: '1.0.0'
})

server.registerTool(
  'companion_report',
  {
    title: 'Speak through Ghou',
    description: COMPANION_REPORT_DESCRIPTION,
    inputSchema: {
      agentName: z
        .string()
        .default('Codex')
        .describe('Name of the CLI agent that Ghou is accompanying, such as Codex.'),
      cliState: z
        .enum(CLI_STATES)
        .describe('Current agent state: working, done, error, waiting_input, or idle.'),
      cwd: z.string().optional().describe('Current working directory, when known.'),
      details: z
        .string()
        .optional()
        .describe(
          'Optional technical details. Keep this factual and short; the UI shows it below the main message.'
        ),
      eventType: z
        .enum(COMPANION_EVENT_TYPES)
        .optional()
        .describe(
          'Semantic event type for this update: started, finished, blocked, failed, needs_input, or note.'
        ),
      projectColor: z
        .string()
        .optional()
        .describe(
          'Optional fallback project color. Pixel Companion usually resolves this automatically.'
        ),
      projectId: z
        .string()
        .optional()
        .describe(
          'Optional fallback project id. Pixel Companion usually resolves this automatically.'
        ),
      projectName: z
        .string()
        .optional()
        .describe(
          'Optional fallback project name. Pixel Companion usually resolves this automatically.'
        ),
      sessionName: z
        .string()
        .optional()
        .describe(
          'Optional fallback terminal/session name, such as Assistant, Backend, or Frontend.'
        ),
      summary: z
        .string()
        .min(1)
        .describe(
          `The exact text ${COMPANION_NAME} will say to the user. Write naturally, like a companion who understood the work. Follow this voice guidance: ${getCompanionVoiceGuidance()}`
        ),
      title: z
        .string()
        .optional()
        .describe('Short internal label for this message. The user-facing text belongs in summary.')
    }
  },
  async (input) => {
    const message = await createMessage(input)
    const state = await writeMessage(message)
    const progressUpdate = await updateCompanionProgress(message)
    const reply = createReply(message)

    return {
      content: [
        {
          type: 'text',
          text: input.details ? `${reply}\nDetalhes: ${input.details}` : reply
        }
      ],
      structuredContent: {
        companionProfile: COMPANION_PROFILE,
        companionVoiceGuidance: getCompanionVoiceGuidance(),
        message,
        progress: progressUpdate.progress,
        xpAward: progressUpdate.award,
        state
      }
    }
  }
)

server.registerTool(
  'companion_get_profile',
  {
    title: 'Get active companion profile',
    description:
      'Read the active Pixel Companion personality and reporting contract. Use this after a context reset or when you are unsure how Ghou should speak.',
    inputSchema: {}
  },
  async () => {
    const voiceGuidance = getCompanionVoiceGuidance()

    return {
      content: [
        {
          type: 'text',
          text: `${COMPANION_NAME} profile: ${voiceGuidance}`
        }
      ],
      structuredContent: {
        companionProfile: COMPANION_PROFILE,
        companionVoiceGuidance: voiceGuidance,
        reportWith: {
          tool: 'companion_report',
          when: [
            'meaningful work starts',
            'meaningful work finishes',
            'work fails',
            'the agent is blocked',
            'the agent needs user input'
          ],
          style:
            'natural user-facing companion speech, matching the user language and style without mentioning MCP/tool calls'
        }
      }
    }
  }
)

server.registerTool(
  'companion_list_projects',
  {
    title: 'List companion projects',
    description:
      'List configured Pixel Companion projects, colors, terminal names, and folders so agents can report with the correct project context.',
    inputSchema: {}
  },
  async () => {
    const { projects, terminalConfigs } = await readWorkspaceConfig()
    const projectSummaries = projects.map((project) => ({
      id: project.id,
      name: project.name,
      color: project.color,
      terminals: terminalConfigs
        .filter((config) => config.projectId === project.id)
        .map((config) => ({
          cwd: config.cwd,
          kind: config.kind,
          name: config.name
        }))
    }))

    return {
      content: [
        {
          type: 'text',
          text: projectSummaries
            .map((project) => {
              const terminals = project.terminals
                .map((terminal) => `${terminal.name}: ${terminal.cwd || 'home'}`)
                .join('; ')
              return `${project.name} (${project.color})${terminals ? ` - ${terminals}` : ''}`
            })
            .join('\n')
        }
      ],
      structuredContent: {
        projects: projectSummaries
      }
    }
  }
)

server.registerTool(
  'companion_get_state',
  {
    title: 'Get companion state',
    description: 'Read the current Pixel Companion bridge state and recent messages.',
    inputSchema: {
      limit: z.number().int().min(1).max(MAX_MESSAGES).default(10)
    }
  },
  async ({ limit }) => {
    const state = await readState()
    const progress = await readProgress()
    const messages = state.messages.slice(-limit)

    return {
      content: [
        {
          type: 'text',
          text: `${COMPANION_NAME} > estado atual: ${state.currentState}. Mensagens recentes: ${messages.length}.`
        }
      ],
      structuredContent: {
        ...state,
        companionProfile: COMPANION_PROFILE,
        companionVoiceGuidance: getCompanionVoiceGuidance(),
        messages,
        progress
      }
    }
  }
)

const transport = new StdioServerTransport()
await server.connect(transport)
