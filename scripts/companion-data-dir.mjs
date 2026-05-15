/* eslint-disable @typescript-eslint/explicit-function-return-type */

import os from 'node:os'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { getAncestorPids } from './companion-project-context.mjs'

const DEFAULT_USER_DATA_DIR = 'pixel-coding-companion'
const DEV_USER_DATA_DIR = 'pixel-coding-companion-dev'

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function pushUnique(items, value) {
  if (!isNonEmptyString(value)) return
  const normalizedValue = path.normalize(value)
  if (!items.some((item) => path.normalize(item) === normalizedValue)) {
    items.push(value)
  }
}

export function getPlatformDataDir(
  userDataDir = DEFAULT_USER_DATA_DIR,
  { env = process.env, homeDir = os.homedir(), platform = process.platform } = {}
) {
  if (platform === 'darwin') {
    return path.join(homeDir, 'Library/Application Support', userDataDir)
  }
  if (platform === 'win32') {
    return path.join(env.APPDATA ?? homeDir, userDataDir)
  }

  return path.join(env.XDG_CONFIG_HOME ?? path.join(homeDir, '.config'), userDataDir)
}

export function getDefaultDataDir({
  env = process.env,
  homeDir = os.homedir(),
  platform = process.platform
} = {}) {
  if (env.PIXEL_COMPANION_DATA_DIR) return env.PIXEL_COMPANION_DATA_DIR
  if (env.PIXEL_COMPANION_USER_DATA_DIR) {
    return getPlatformDataDir(env.PIXEL_COMPANION_USER_DATA_DIR, { env, homeDir, platform })
  }
  return getPlatformDataDir(DEFAULT_USER_DATA_DIR, { env, homeDir, platform })
}

export function getDataDirFromContextFile(contextFile) {
  if (!isNonEmptyString(contextFile)) return undefined

  const contextDirectory = path.dirname(path.resolve(contextFile))
  if (path.basename(contextDirectory) !== 'terminal-contexts') return undefined

  return path.dirname(contextDirectory)
}

function hasDevInstanceHint(env) {
  const values = [
    env.PIXEL_COMPANION_APP_ID,
    env.PIXEL_COMPANION_APP_NAME,
    env.PIXEL_COMPANION_USER_DATA_DIR,
    env.__CFBundleIdentifier
  ]

  return values.some(
    (value) => typeof value === 'string' && /(?:^|[.\s-])dev(?:$|[.\s-])/i.test(value)
  )
}

export function getCompanionDataDirCandidates({
  env = process.env,
  homeDir = os.homedir(),
  platform = process.platform
} = {}) {
  const candidates = []
  const devDataDir = getPlatformDataDir(DEV_USER_DATA_DIR, { env, homeDir, platform })
  const productionDataDir = getPlatformDataDir(DEFAULT_USER_DATA_DIR, { env, homeDir, platform })

  pushUnique(candidates, env.PIXEL_COMPANION_DATA_DIR)
  pushUnique(candidates, getDataDirFromContextFile(env.PIXEL_COMPANION_CONTEXT_FILE))
  if (env.PIXEL_COMPANION_USER_DATA_DIR) {
    pushUnique(
      candidates,
      getPlatformDataDir(env.PIXEL_COMPANION_USER_DATA_DIR, { env, homeDir, platform })
    )
  }

  if (hasDevInstanceHint(env)) {
    pushUnique(candidates, devDataDir)
    pushUnique(candidates, productionDataDir)
  } else {
    pushUnique(candidates, productionDataDir)
    pushUnique(candidates, devDataDir)
  }

  return candidates
}

async function readTerminalContextRegistry(terminalContextRegistryPath, readFileFn = readFile) {
  try {
    const file = await readFileFn(terminalContextRegistryPath, 'utf8')
    const registry = JSON.parse(file)
    return Array.isArray(registry) ? registry : []
  } catch (error) {
    if (error && error.code === 'ENOENT') return []
    if (error instanceof SyntaxError) return []
    throw error
  }
}

function getRegistryEntryTime(entry) {
  const timestamp = Date.parse(entry.updatedAt ?? entry.startedAt ?? '')
  return Number.isFinite(timestamp) ? timestamp : 0
}

export async function findDataDirForProcessTree({
  candidateDataDirs,
  collectAncestorPids = getAncestorPids,
  pid = process.pid,
  readRegistry = readTerminalContextRegistry
} = {}) {
  const ancestors = await collectAncestorPids(pid)
  if (!ancestors || ancestors.size === 0) return undefined

  let bestMatch

  for (const [candidateIndex, candidateDataDir] of (candidateDataDirs ?? []).entries()) {
    const { terminalContextRegistryPath } = createCompanionDataPaths(candidateDataDir)
    const registry = await readRegistry(terminalContextRegistryPath)
    const matchingEntry = registry
      .filter((entry) => ancestors.has(Number(entry.shellPid)))
      .sort((left, right) => getRegistryEntryTime(right) - getRegistryEntryTime(left))[0]

    if (!matchingEntry) continue

    const match = {
      candidateDataDir,
      candidateIndex,
      timestamp: getRegistryEntryTime(matchingEntry)
    }

    if (
      !bestMatch ||
      match.timestamp > bestMatch.timestamp ||
      (match.timestamp === bestMatch.timestamp && match.candidateIndex < bestMatch.candidateIndex)
    ) {
      bestMatch = match
    }
  }

  return bestMatch?.candidateDataDir
}

export async function resolveCompanionDataDir({
  collectAncestorPids = getAncestorPids,
  env = process.env,
  homeDir = os.homedir(),
  pid = process.pid,
  platform = process.platform,
  readRegistry = readTerminalContextRegistry
} = {}) {
  if (env.PIXEL_COMPANION_DATA_DIR) return env.PIXEL_COMPANION_DATA_DIR

  const contextDataDir = getDataDirFromContextFile(env.PIXEL_COMPANION_CONTEXT_FILE)
  if (contextDataDir) return contextDataDir

  if (env.PIXEL_COMPANION_USER_DATA_DIR) {
    return getPlatformDataDir(env.PIXEL_COMPANION_USER_DATA_DIR, { env, homeDir, platform })
  }

  const processTreeDataDir = await findDataDirForProcessTree({
    candidateDataDirs: getCompanionDataDirCandidates({ env, homeDir, platform }),
    collectAncestorPids,
    pid,
    readRegistry
  })

  return processTreeDataDir ?? getDefaultDataDir({ env, homeDir, platform })
}

export function createCompanionDataPaths(dataDir) {
  return {
    eventsPath: path.join(dataDir, 'companion-events.jsonl'),
    externalTerminalRegistryPath: path.join(dataDir, 'external-terminals.json'),
    progressPath: path.join(dataDir, 'companion-progress.json'),
    statePath: path.join(dataDir, 'companion-state.json'),
    terminalContextRegistryPath: path.join(dataDir, 'terminal-contexts', 'registry.json'),
    workspacesPath: path.join(dataDir, 'workspaces.json')
  }
}
