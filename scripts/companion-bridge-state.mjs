/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { appendFile, mkdir } from 'node:fs/promises'
import { readJsonFile, writeJsonAtomic } from './companion-json-store.mjs'

export const MAX_MESSAGES = 80
export const CLI_STATES = ['idle', 'working', 'done', 'error', 'waiting_input']
export const COMPANION_EVENT_TYPES = [
  'started',
  'finished',
  'blocked',
  'failed',
  'needs_input',
  'note'
]

export function createDefaultState() {
  return {
    currentState: 'idle',
    messages: []
  }
}

export function isValidState(value) {
  return CLI_STATES.includes(value)
}

export function isValidCompanionEventType(value) {
  return COMPANION_EVENT_TYPES.includes(value)
}

export function getDefaultEventType(cliState) {
  if (cliState === 'working') return 'started'
  if (cliState === 'done') return 'finished'
  if (cliState === 'error') return 'failed'
  if (cliState === 'waiting_input') return 'needs_input'
  return 'note'
}

export function normalizeMessage(message, { companionId, companionName } = {}) {
  if (!message || typeof message !== 'object') return null
  if (typeof message.id !== 'string') return null
  if (typeof message.createdAt !== 'string') return null
  if (typeof message.title !== 'string') return null
  if (typeof message.summary !== 'string') return null

  return {
    id: message.id,
    agentName: typeof message.agentName === 'string' ? message.agentName : undefined,
    cliState: isValidState(message.cliState) ? message.cliState : 'idle',
    companionId: typeof message.companionId === 'string' ? message.companionId : companionId,
    companionName:
      typeof message.companionName === 'string' ? message.companionName : companionName,
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

export function normalizeState(state, options = {}) {
  if (!state || typeof state !== 'object') return createDefaultState()

  const messages = Array.isArray(state.messages)
    ? state.messages.map((message) => normalizeMessage(message, options)).filter(Boolean)
    : []

  return {
    currentState: isValidState(state.currentState) ? state.currentState : 'idle',
    messages: messages.slice(-MAX_MESSAGES),
    updatedAt: typeof state.updatedAt === 'string' ? state.updatedAt : undefined
  }
}

export async function readBridgeState(statePath, options = {}) {
  return readJsonFile(statePath, {
    fallback: createDefaultState,
    normalize: (state) => normalizeState(state, options),
    swallowSyntax: Boolean(options.swallowSyntax)
  })
}

export async function writeBridgeMessage({
  dataDir,
  eventsPath,
  message,
  statePath,
  stateOptions = {}
}) {
  await mkdir(dataDir, { recursive: true })

  const currentState = await readBridgeState(statePath, stateOptions)
  const nextState = {
    currentState: message.cliState,
    messages: [...currentState.messages, message].slice(-MAX_MESSAGES),
    updatedAt: message.createdAt
  }

  await writeJsonAtomic(statePath, nextState)
  await appendFile(eventsPath, `${JSON.stringify(message)}\n`, 'utf8')

  return nextState
}
