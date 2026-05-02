#!/usr/bin/env node
/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { createHash, randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod/v4'
import {
  CLI_STATES,
  COMPANION_EVENT_TYPES,
  MAX_MESSAGES,
  getDefaultEventType,
  isValidCompanionEventType,
  readBridgeState,
  writeBridgeMessage
} from './companion-bridge-state.mjs'
import { createCompanionDataPaths, getDefaultDataDir } from './companion-data-dir.mjs'
import { writeJsonAtomic } from './companion-json-store.mjs'
import {
  getCompanionProfile,
  getCompanionReportDescription,
  getCompanionVoiceGuidance as buildCompanionVoiceGuidance,
  readActiveCompanionProfile
} from './companion-profile.mjs'
import {
  applyXpToActiveCompanion,
  createActiveCompanionProgressSnapshot
} from './companion-store-progress.mjs'

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`Pixel Companion MCP

Usage:
  node scripts/pixel-companion-mcp.mjs

Runs the Pixel Companion MCP server over stdio.

Tools:
  companion_report
  companion_get_profile
  companion_list_projects
  companion_get_state`)
  process.exit(0)
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
const execFileAsync = promisify(execFile)
const MAX_COMPANION_LEVEL = 100
const BASE_NEXT_LEVEL_XP = 120
const LEVEL_XP_GROWTH = 1.13
const ACTIVE_TURN_TIMEOUT_MS = 4 * 60 * 60 * 1000
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
const COMPANION_REPORT_DESCRIPTION = getCompanionReportDescription(COMPANION_PROFILE)

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

function getCompanionVoiceGuidance(profile = COMPANION_PROFILE) {
  return buildCompanionVoiceGuidance(profile)
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

async function readState() {
  return readBridgeState(statePath, {
    companionId: COMPANION_ID,
    companionName: COMPANION_NAME
  })
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
  return writeBridgeMessage({
    dataDir,
    eventsPath,
    message,
    statePath,
    stateOptions: {
      companionId: COMPANION_ID,
      companionName: COMPANION_NAME
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

function createReply(message) {
  return `${message.companionName ?? COMPANION_NAME} > ${message.summary}`
}

async function createMessage(input) {
  const now = new Date().toISOString()
  const resolvedProject = await resolveProject(input)
  const companionProfile = await readActiveCompanionProfile(dataDir)

  return {
    id: randomUUID(),
    agentName: input.agentName,
    cliState: input.cliState,
    companionId: companionProfile.id,
    companionName: companionProfile.name,
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
    title: `Speak through ${COMPANION_NAME}`,
    description: COMPANION_REPORT_DESCRIPTION,
    inputSchema: {
      agentName: z
        .string()
        .default('Codex')
        .describe(`Name of the CLI agent that ${COMPANION_NAME} is accompanying, such as Codex.`),
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
    const companionProfile = getCompanionProfile(message.companionId)
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
        companionProfile,
        companionVoiceGuidance: getCompanionVoiceGuidance(companionProfile),
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
      'Read the active Pixel Companion personality and reporting contract. Use this after a context reset or when you are unsure how the active companion should speak.',
    inputSchema: {}
  },
  async () => {
    const companionProfile = await readActiveCompanionProfile(dataDir)
    const voiceGuidance = getCompanionVoiceGuidance(companionProfile)

    return {
      content: [
        {
          type: 'text',
          text: `${companionProfile.name} profile: ${voiceGuidance}`
        }
      ],
      structuredContent: {
        companionProfile,
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
    const progressState = await readProgress()
    const progress = await createActiveCompanionProgressSnapshot(dataDir, progressState)
    const companionProfile = await readActiveCompanionProfile(dataDir)
    const messages = state.messages.slice(-limit)

    return {
      content: [
        {
          type: 'text',
          text: `${companionProfile.name} > estado atual: ${state.currentState}. Mensagens recentes: ${messages.length}.`
        }
      ],
      structuredContent: {
        ...state,
        companionProfile,
        companionVoiceGuidance: getCompanionVoiceGuidance(companionProfile),
        messages,
        progress
      }
    }
  }
)

const transport = new StdioServerTransport()
await server.connect(transport)
