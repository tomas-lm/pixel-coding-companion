#!/usr/bin/env node
/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  formatCompactLog,
  getCompactLogPath,
  listCompactLogIds,
  readCompactLog
} from './pixel-compact-logs.mjs'
import { runCompactCommand } from './pixel-compact-runner.mjs'
import {
  applyClaudePixelHooks,
  applyCodexPixelHooks,
  ensureCodexHooksFeature
} from './pixel-hook-config.mjs'
import { installPixelVaultBootstrapSkill } from './pixel-skill-installer.mjs'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..')
const hookScriptPath = path.join(scriptDir, 'pixel-companion-hook.mjs')
const mcpScriptPath = path.join(scriptDir, 'pixel-companion-mcp.mjs')
const CODEX_DIR = path.join(os.homedir(), '.codex')
const CODEX_CONFIG_PATH = path.join(CODEX_DIR, 'config.toml')
const CODEX_HOOKS_PATH = path.join(CODEX_DIR, 'hooks.json')
const CLAUDE_DIR = path.join(os.homedir(), '.claude')
const CLAUDE_SETTINGS_PATH = path.join(CLAUDE_DIR, 'settings.json')
const CLAUDE_MCP_SERVER_NAME = 'pixel-companion'

function printUsage() {
  process.stdout.write(`Pixel Companion CLI

Usage:
  pixel codex [...codex args]
  pixel claude [...claude args]
  pixel run --compact -- <command...>
  pixel logs show <raw-output-id>
  pixel logs open <raw-output-id>

Commands:
  codex    Launch Codex with Pixel Companion hooks enabled.
  claude   Launch Claude Code with Pixel Companion hooks enabled.
  run      Run a command through Pixel's compact output filter.
  logs     Show or open raw compact-output logs.

Examples:
  pixel codex
  pixel codex --yolo
  pixel claude
  pixel claude --dangerously-skip-permissions
  pixel run --compact -- npm test
  pixel logs show pxout_20260512010101_abcdef1234
`)
}

async function ensureCodexFeatureFlag() {
  await mkdir(CODEX_DIR, { recursive: true })

  let currentConfig = ''
  try {
    currentConfig = await readFile(CODEX_CONFIG_PATH, 'utf8')
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }

  const nextConfig = ensureCodexHooksFeature(currentConfig)
  if (nextConfig !== currentConfig) {
    await writeFile(CODEX_CONFIG_PATH, nextConfig, 'utf8')
    return true
  }

  return false
}

async function readCodexHooksConfig() {
  try {
    const hooksConfig = JSON.parse(await readFile(CODEX_HOOKS_PATH, 'utf8'))
    return hooksConfig && typeof hooksConfig === 'object' ? hooksConfig : { hooks: {} }
  } catch (error) {
    if (error?.code === 'ENOENT') return { hooks: {} }
    throw error
  }
}

async function readClaudeSettingsConfig() {
  try {
    const settingsConfig = JSON.parse(await readFile(CLAUDE_SETTINGS_PATH, 'utf8'))
    return settingsConfig && typeof settingsConfig === 'object' ? settingsConfig : { hooks: {} }
  } catch (error) {
    if (error?.code === 'ENOENT') return { hooks: {} }
    throw error
  }
}

async function ensureCodexHooks() {
  if (!existsSync(hookScriptPath)) {
    throw new Error(`Pixel Companion hook script was not found at ${hookScriptPath}`)
  }

  const featureFlagChanged = await ensureCodexFeatureFlag()
  let hooksConfig = await readCodexHooksConfig()

  hooksConfig = applyCodexPixelHooks(hooksConfig, hookScriptPath)

  await mkdir(CODEX_DIR, { recursive: true })
  await writeFile(CODEX_HOOKS_PATH, `${JSON.stringify(hooksConfig, null, 2)}\n`, 'utf8')

  return {
    featureFlagChanged,
    hooksPath: CODEX_HOOKS_PATH
  }
}

async function ensureClaudeHooks() {
  if (!existsSync(hookScriptPath)) {
    throw new Error(`Pixel Companion hook script was not found at ${hookScriptPath}`)
  }

  let settingsConfig = await readClaudeSettingsConfig()

  settingsConfig = applyClaudePixelHooks(settingsConfig, hookScriptPath)

  await mkdir(CLAUDE_DIR, { recursive: true })
  await writeFile(CLAUDE_SETTINGS_PATH, `${JSON.stringify(settingsConfig, null, 2)}\n`, 'utf8')

  return {
    hooksPath: CLAUDE_SETTINGS_PATH
  }
}

function runClaudeMcpCommand(args) {
  return spawnSync('claude', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 10000
  })
}

function summarizeCommandFailure(result) {
  if (result.error) return result.error.message

  const output = `${result.stderr ?? ''}${result.stdout ?? ''}`.trim()
  return output || `exit ${result.status ?? 'unknown'}`
}

function ensureClaudeMcpServer() {
  if (!existsSync(mcpScriptPath)) {
    throw new Error(`Pixel Companion MCP script was not found at ${mcpScriptPath}`)
  }

  const current = runClaudeMcpCommand(['mcp', 'get', CLAUDE_MCP_SERVER_NAME])
  const existingOutput = `${current.stdout ?? ''}${current.stderr ?? ''}`

  if (current.status === 0 && existingOutput.includes(mcpScriptPath)) {
    return {
      configured: false
    }
  }

  if (current.status === 0) {
    runClaudeMcpCommand(['mcp', 'remove', CLAUDE_MCP_SERVER_NAME])
  }

  const added = runClaudeMcpCommand([
    'mcp',
    'add',
    '--transport',
    'stdio',
    '--scope',
    'user',
    CLAUDE_MCP_SERVER_NAME,
    '--',
    'node',
    mcpScriptPath
  ])

  if (added.status !== 0) {
    throw new Error(summarizeCommandFailure(added))
  }

  return {
    configured: true
  }
}

async function ensurePixelSkills() {
  const result = await installPixelVaultBootstrapSkill({
    repoRoot
  })
  const changedTargets = result.targets.filter((target) => target.status !== 'current')

  return {
    changedTargets,
    sourcePath: result.sourcePath,
    targets: result.targets
  }
}

async function tryEnsurePixelSkills() {
  try {
    const result = await ensurePixelSkills()
    const summary =
      result.changedTargets.length > 0
        ? result.changedTargets.map((target) => `${target.agent}:${target.status}`).join(', ')
        : 'already current'
    process.stderr.write(`Pixel Companion: pixel-vault-bootstrap skill ${summary}.\n`)
  } catch (error) {
    process.stderr.write(
      `Pixel Companion: could not install Pixel skills (${error instanceof Error ? error.message : String(error)}).\n`
    )
  }
}

async function runCodex(args) {
  try {
    const result = await ensureCodexHooks()
    const changedLabel = result.featureFlagChanged ? ' and enabled Codex hooks' : ''
    process.stderr.write(
      `Pixel Companion: installed Codex hooks at ${result.hooksPath}${changedLabel}.\n`
    )
  } catch (error) {
    process.stderr.write(
      `Pixel Companion: could not install Codex hooks (${error instanceof Error ? error.message : String(error)}). Launching Codex anyway.\n`
    )
  }

  await tryEnsurePixelSkills()

  const child = spawn('codex', args, {
    env: {
      ...process.env,
      PIXEL_COMPANION_CLI_REPO: repoRoot,
      PIXEL_COMPANION_HOOK_SCRIPT: hookScriptPath,
      PIXEL_COMPANION_START_WITH_PIXEL: '1',
      PIXEL_COMPANION_WRAPPED_CLI: 'codex'
    },
    stdio: 'inherit'
  })

  child.on('error', (error) => {
    process.stderr.write(`Pixel Companion: failed to launch codex (${error.message}).\n`)
    process.exit(1)
  })

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal)
      return
    }

    process.exit(code ?? 0)
  })
}

async function runClaude(args) {
  try {
    const result = await ensureClaudeHooks()
    process.stderr.write(`Pixel Companion: installed Claude Code hooks at ${result.hooksPath}.\n`)
  } catch (error) {
    process.stderr.write(
      `Pixel Companion: could not install Claude Code hooks (${error instanceof Error ? error.message : String(error)}). Launching Claude Code anyway.\n`
    )
  }

  await tryEnsurePixelSkills()

  try {
    const result = ensureClaudeMcpServer()
    const configuredLabel = result.configured ? 'configured' : 'verified'
    process.stderr.write(`Pixel Companion: ${configuredLabel} Claude Code MCP server.\n`)
  } catch (error) {
    process.stderr.write(
      `Pixel Companion: could not configure Claude Code MCP (${error instanceof Error ? error.message : String(error)}). Launching Claude Code anyway.\n`
    )
  }

  const child = spawn('claude', args, {
    env: {
      ...process.env,
      PIXEL_COMPANION_CLI_REPO: repoRoot,
      PIXEL_COMPANION_HOOK_SCRIPT: hookScriptPath,
      PIXEL_COMPANION_MCP_SCRIPT: mcpScriptPath,
      PIXEL_COMPANION_START_WITH_PIXEL: '1',
      PIXEL_COMPANION_WRAPPED_CLI: 'claude'
    },
    stdio: 'inherit'
  })

  child.on('error', (error) => {
    process.stderr.write(`Pixel Companion: failed to launch claude (${error.message}).\n`)
    process.exit(1)
  })

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal)
      return
    }

    process.exit(code ?? 0)
  })
}

function parseCompactRunArgs(args) {
  const separatorIndex = args.indexOf('--')
  const optionArgs = separatorIndex === -1 ? args : args.slice(0, separatorIndex)
  const commandArgs = separatorIndex === -1 ? [] : args.slice(separatorIndex + 1)

  if (!optionArgs.includes('--compact')) {
    throw new Error('Only compact runs are supported. Use: pixel run --compact -- <command...>')
  }

  if (commandArgs.length === 0) {
    throw new Error('Missing command. Use: pixel run --compact -- <command...>')
  }

  return commandArgs
}

async function runCompact(args) {
  const commandArgs = parseCompactRunArgs(args)
  const result = await runCompactCommand(commandArgs)
  process.stdout.write(result.summary)
  process.exit(result.exitCode)
}

async function showCompactLog(args) {
  const [id] = args
  if (!id) {
    const ids = await listCompactLogIds()
    if (ids.length === 0) {
      process.stdout.write('Pixel Companion: no compact output logs found.\n')
      return
    }

    process.stdout.write(`${ids.join('\n')}\n`)
    return
  }

  process.stdout.write(formatCompactLog(await readCompactLog(id)))
}

function openPath(filePath) {
  if (process.platform === 'darwin') return spawnSync('open', [filePath], { stdio: 'inherit' })
  if (process.platform === 'win32') {
    return spawnSync('cmd', ['/c', 'start', '', filePath], { stdio: 'inherit' })
  }

  return spawnSync('xdg-open', [filePath], { stdio: 'inherit' })
}

function openCompactLog(args) {
  const [id] = args
  if (!id) throw new Error('Missing raw output id. Use: pixel logs open <raw-output-id>')

  const result = openPath(getCompactLogPath(id))
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}

async function runLogs(args) {
  const [subcommand, ...rest] = args

  if (!subcommand || subcommand === 'show') {
    await showCompactLog(rest)
    return
  }

  if (subcommand === 'open') {
    openCompactLog(rest)
    return
  }

  throw new Error(`Unknown logs subcommand "${subcommand}". Use "show" or "open".`)
}

const [command, ...args] = process.argv.slice(2)

if (!command || command === '--help' || command === '-h') {
  printUsage()
  process.exit(0)
}

if (command === 'codex') {
  await runCodex(args)
} else if (command === 'claude') {
  await runClaude(args)
} else if (command === 'run') {
  await runCompact(args)
} else if (command === 'logs') {
  await runLogs(args)
} else {
  process.stderr.write(`Pixel Companion: unknown command "${command}".\n\n`)
  printUsage()
  process.exit(1)
}
