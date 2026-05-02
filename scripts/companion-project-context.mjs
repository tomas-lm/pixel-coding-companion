/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import { writeJsonAtomic } from './companion-json-store.mjs'

const execFileAsync = promisify(execFile)

export const EXTERNAL_TERMINAL_COLORS = [
  '#ff8bd1',
  '#f97316',
  '#a3e635',
  '#22d3ee',
  '#f43f5e',
  '#e879f9',
  '#facc15',
  '#94a3b8'
]

export function isHexColor(value) {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
}

export function readEnvContext(env = process.env) {
  return {
    contextSource: 'env',
    cwd: env.PIXEL_COMPANION_CWD,
    projectColor: env.PIXEL_COMPANION_PROJECT_COLOR,
    projectId: env.PIXEL_COMPANION_PROJECT_ID,
    projectName: env.PIXEL_COMPANION_PROJECT_NAME,
    sessionId: env.PIXEL_COMPANION_SESSION_ID,
    terminalId: env.PIXEL_COMPANION_TERMINAL_ID,
    terminalName: env.PIXEL_COMPANION_TERMINAL_NAME
  }
}

export async function readContextFile(env = process.env) {
  const contextFile = env.PIXEL_COMPANION_CONTEXT_FILE
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

export async function readTerminalContextRegistry(terminalContextRegistryPath) {
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

export async function getParentPid(pid, platform = process.platform) {
  if (platform === 'win32') return null

  try {
    const { stdout } = await execFileAsync('ps', ['-o', 'ppid=', '-p', String(pid)])
    const parentPid = Number(stdout.trim())
    return Number.isFinite(parentPid) && parentPid > 0 ? parentPid : null
  } catch {
    return null
  }
}

export async function getAncestorPids(pid) {
  const ancestors = new Set()
  let currentPid = pid

  for (let depth = 0; depth < 40 && currentPid && !ancestors.has(currentPid); depth += 1) {
    ancestors.add(currentPid)
    currentPid = await getParentPid(currentPid)
  }

  return ancestors
}

export async function readProcessTreeContext({ pid = process.pid, terminalContextRegistryPath }) {
  const registry = await readTerminalContextRegistry(terminalContextRegistryPath)
  if (registry.length === 0) return {}

  const ancestors = await getAncestorPids(pid)
  const context = registry.find((entry) => ancestors.has(entry.shellPid))
  if (!context) return {}

  return {
    contextSource: 'process_tree',
    ...context
  }
}

export async function readBoundContext(options) {
  return {
    ...readEnvContext(options.env),
    ...(await readContextFile(options.env)),
    ...(await readProcessTreeContext(options))
  }
}

export async function readWorkspaceConfig(workspacesPath) {
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

export function getProjectById(projects, projectId) {
  return projects.find((project) => typeof project.id === 'string' && project.id === projectId)
}

export function hasStrongBoundContext(context) {
  return Boolean(
    context.projectId ||
    context.projectName ||
    context.projectColor ||
    context.sessionId ||
    context.terminalId ||
    context.terminalName
  )
}

export async function readExternalTerminalRegistry(externalTerminalRegistryPath) {
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

export async function writeExternalTerminalRegistry(externalTerminalRegistryPath, registry) {
  await writeJsonAtomic(externalTerminalRegistryPath, registry)
}

export async function getExternalTerminalKey(input, { env = process.env, pid = process.pid } = {}) {
  const parentPid = await getParentPid(pid)
  const cwd = typeof input.cwd === 'string' && input.cwd.trim() ? path.resolve(input.cwd) : ''
  const wrappedCli = env.PIXEL_COMPANION_WRAPPED_CLI ?? input.agentName ?? 'external'

  return [wrappedCli, parentPid ?? pid, cwd].filter(Boolean).join('|')
}

export function getNextExternalTerminalNumber(registry) {
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

export function getExternalTerminalColor(number, projects) {
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

export async function resolveExternalTerminal(input, projects, options) {
  const registry = await readExternalTerminalRegistry(options.externalTerminalRegistryPath)
  const key = await getExternalTerminalKey(input, options)
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

  await writeExternalTerminalRegistry(options.externalTerminalRegistryPath, nextRegistry)

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

export async function resolveProject(input, options) {
  const boundContext = await readBoundContext(options)
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

  const { projects } = await readWorkspaceConfig(options.workspacesPath)
  const project = getProjectById(projects, input.projectId)

  if (!project) {
    return resolveExternalTerminal(input, projects, options)
  }

  return {
    cwd: input.cwd,
    contextSource: 'workspace',
    projectColor: isHexColor(project.color) ? project.color : undefined,
    projectId: project.id,
    projectName: project.name
  }
}
