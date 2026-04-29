#!/usr/bin/env node
/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
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
const workspacesPath = path.join(dataDir, 'workspaces.json')
const terminalContextRegistryPath = path.join(dataDir, 'terminal-contexts', 'registry.json')
const COMPANION_NAME = 'Ghou'
const execFileAsync = promisify(execFile)
const COMPANION_REPORT_DESCRIPTION = [
  'Send a user-facing message from Ghou, the Pixel Companion, about what just happened in this CLI session.',
  'The summary is displayed directly in the companion terminal, so write it like natural companion speech, not like an audit log or MCP status record.',
  'Prefer concise first-person Portuguese when the user speaks Portuguese. Examples: "Terminei de rodar os testes do backend. Passou tudo." or "O build quebrou no typecheck; o erro principal foi X."',
  'Do not write phrases like "Task concluida:", "Resumo:", "Mensagem registrada", "Status atualizado", or "companion_report foi chamado".'
].join(' ')

function createDefaultState() {
  return {
    currentState: 'idle',
    messages: []
  }
}

function isValidState(value) {
  return CLI_STATES.includes(value)
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
    contextSource: typeof message.contextSource === 'string' ? message.contextSource : undefined,
    createdAt: message.createdAt,
    cwd: typeof message.cwd === 'string' ? message.cwd : undefined,
    details: typeof message.details === 'string' ? message.details : undefined,
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

async function readState() {
  try {
    const file = await readFile(statePath, 'utf8')
    return normalizeState(JSON.parse(file))
  } catch (error) {
    if (error && error.code === 'ENOENT') return createDefaultState()
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

  await writeFile(statePath, `${JSON.stringify(nextState, null, 2)}\n`, 'utf8')
  await appendFile(eventsPath, `${JSON.stringify(message)}\n`, 'utf8')

  return nextState
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
    contextSource: resolvedProject.contextSource,
    createdAt: now,
    cwd: resolvedProject.cwd ?? input.cwd,
    details: input.details,
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
          'The exact text Ghou will say to the user. Write naturally, like a companion who understood the work. Do not write a log summary or mention MCP/tool calls.'
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
        messages
      }
    }
  }
)

const transport = new StdioServerTransport()
await server.connect(transport)
