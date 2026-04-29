#!/usr/bin/env node
/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { randomUUID } from 'node:crypto'
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod/v4'

const MAX_MESSAGES = 80
const CLI_STATES = ['idle', 'working', 'done', 'error', 'waiting_input']

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

function createDefaultState() {
  return {
    currentState: 'idle',
    messages: []
  }
}

function isValidState(value) {
  return CLI_STATES.includes(value)
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
    createdAt: message.createdAt,
    details: typeof message.details === 'string' ? message.details : undefined,
    projectColor: typeof message.projectColor === 'string' ? message.projectColor : undefined,
    projectName: typeof message.projectName === 'string' ? message.projectName : undefined,
    sessionName: typeof message.sessionName === 'string' ? message.sessionName : undefined,
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

async function readState() {
  try {
    const file = await readFile(statePath, 'utf8')
    return normalizeState(JSON.parse(file))
  } catch (error) {
    if (error && error.code === 'ENOENT') return createDefaultState()
    throw error
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

function createReply(message) {
  const actor = message.agentName ?? 'CLI'
  const project = message.projectName ? ` em ${message.projectName}` : ''

  if (message.cliState === 'working') {
    return `Pixel Companion > ${actor}${project} esta trabalhando.\nResumo: ${message.summary}`
  }
  if (message.cliState === 'done') {
    return `Pixel Companion > ${actor}${project} terminou.\nResumo: ${message.summary}`
  }
  if (message.cliState === 'error') {
    return `Pixel Companion > ${actor}${project} encontrou erro.\nResumo: ${message.summary}`
  }
  if (message.cliState === 'waiting_input') {
    return `Pixel Companion > ${actor}${project} esta aguardando input.\nResumo: ${message.summary}`
  }

  return `Pixel Companion > estado registrado.\nResumo: ${message.summary}`
}

function createMessage(input) {
  const now = new Date().toISOString()

  return {
    id: randomUUID(),
    agentName: input.agentName,
    cliState: input.cliState,
    createdAt: now,
    details: input.details,
    projectColor: input.projectColor,
    projectName: input.projectName,
    sessionName: input.sessionName,
    source: 'mcp',
    summary: input.summary,
    title: input.title ?? input.sessionName ?? input.agentName ?? 'CLI update'
  }
}

const server = new McpServer({
  name: 'pixel-companion',
  version: '1.0.0'
})

server.registerTool(
  'companion_report',
  {
    title: 'Report companion state',
    description:
      'Report a CLI agent state change to Pixel Companion and receive a companion-style summary response.',
    inputSchema: {
      agentName: z.string().default('Codex'),
      cliState: z.enum(CLI_STATES),
      details: z.string().optional(),
      projectColor: z.string().optional(),
      projectName: z.string().optional(),
      sessionName: z.string().optional(),
      summary: z.string().min(1),
      title: z.string().optional()
    }
  },
  async (input) => {
    const message = createMessage(input)
    const state = await writeMessage(message)
    const reply = createReply(message)

    return {
      content: [
        {
          type: 'text',
          text: input.details ? `${reply}\nDetalhes: ${input.details}` : reply
        }
      ],
      structuredContent: {
        message,
        state
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
    const messages = state.messages.slice(-limit)

    return {
      content: [
        {
          type: 'text',
          text: `Pixel Companion > estado atual: ${state.currentState}. Mensagens recentes: ${messages.length}.`
        }
      ],
      structuredContent: {
        ...state,
        messages
      }
    }
  }
)

const transport = new StdioServerTransport()
await server.connect(transport)
