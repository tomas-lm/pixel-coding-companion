#!/usr/bin/env node
/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..')
const hookScriptPath = path.join(scriptDir, 'pixel-companion-hook.mjs')
const CODEX_DIR = path.join(os.homedir(), '.codex')
const CODEX_CONFIG_PATH = path.join(CODEX_DIR, 'config.toml')
const CODEX_HOOKS_PATH = path.join(CODEX_DIR, 'hooks.json')
const PIXEL_HOOK_SCRIPT_MARKER = 'pixel-companion-hook.mjs'

function printUsage() {
  process.stdout.write(`Pixel Companion CLI

Usage:
  pixel codex [...codex args]

Commands:
  codex    Launch Codex with Pixel Companion hooks enabled.

Examples:
  pixel codex
  pixel codex --yolo
`)
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`
}

function ensureCodexHooksFeature(contents) {
  const normalizedContents = contents.replace(/\r\n/g, '\n')
  const lines = normalizedContents.split('\n')
  const featuresIndex = lines.findIndex((line) => /^\s*\[features\]\s*$/.test(line))

  if (featuresIndex === -1) {
    const prefix = normalizedContents.trim().length > 0 ? `${normalizedContents.trimEnd()}\n\n` : ''
    return `${prefix}[features]\ncodex_hooks = true\n`
  }

  let sectionEndIndex = lines.length
  for (let index = featuresIndex + 1; index < lines.length; index += 1) {
    if (/^\s*\[.*\]\s*$/.test(lines[index])) {
      sectionEndIndex = index
      break
    }
  }

  const flagIndex = lines.findIndex(
    (line, index) =>
      index > featuresIndex && index < sectionEndIndex && /^\s*codex_hooks\s*=/.test(line)
  )

  if (flagIndex === -1) {
    lines.splice(featuresIndex + 1, 0, 'codex_hooks = true')
  } else {
    lines[flagIndex] = 'codex_hooks = true'
  }

  return `${lines.join('\n').trimEnd()}\n`
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

function createHookCommand(command) {
  return `node ${shellQuote(hookScriptPath)} ${command}`
}

function removePixelHookHandlers(eventGroups) {
  return eventGroups
    .map((group) => {
      const hooks = Array.isArray(group?.hooks)
        ? group.hooks.filter(
            (hook) =>
              !(
                hook &&
                typeof hook.command === 'string' &&
                hook.command.includes(PIXEL_HOOK_SCRIPT_MARKER)
              )
          )
        : []

      return {
        ...group,
        hooks
      }
    })
    .filter((group) => group.hooks.length > 0)
}

function upsertPixelHook(hooksConfig, eventName, group) {
  const hooks = hooksConfig.hooks && typeof hooksConfig.hooks === 'object' ? hooksConfig.hooks : {}
  const currentGroups = Array.isArray(hooks[eventName]) ? hooks[eventName] : []

  return {
    ...hooksConfig,
    hooks: {
      ...hooks,
      [eventName]: [...removePixelHookHandlers(currentGroups), group]
    }
  }
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

async function ensureCodexHooks() {
  if (!existsSync(hookScriptPath)) {
    throw new Error(`Pixel Companion hook script was not found at ${hookScriptPath}`)
  }

  const featureFlagChanged = await ensureCodexFeatureFlag()
  let hooksConfig = await readCodexHooksConfig()

  hooksConfig = upsertPixelHook(hooksConfig, 'SessionStart', {
    matcher: 'startup|resume|clear',
    hooks: [
      {
        type: 'command',
        command: createHookCommand('codex-session-start'),
        timeout: 10,
        statusMessage: 'Loading Pixel Companion context'
      }
    ]
  })
  hooksConfig = upsertPixelHook(hooksConfig, 'UserPromptSubmit', {
    hooks: [
      {
        type: 'command',
        command: createHookCommand('codex-user-prompt-submit'),
        timeout: 10,
        statusMessage: 'Notifying Pixel Companion'
      }
    ]
  })
  hooksConfig = upsertPixelHook(hooksConfig, 'Stop', {
    hooks: [
      {
        type: 'command',
        command: createHookCommand('codex-stop'),
        timeout: 10,
        statusMessage: 'Updating Pixel Companion'
      }
    ]
  })

  await mkdir(CODEX_DIR, { recursive: true })
  await writeFile(CODEX_HOOKS_PATH, `${JSON.stringify(hooksConfig, null, 2)}\n`, 'utf8')

  return {
    featureFlagChanged,
    hooksPath: CODEX_HOOKS_PATH
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

const [command, ...args] = process.argv.slice(2)

if (!command || command === '--help' || command === '-h') {
  printUsage()
  process.exit(0)
}

if (command === 'codex') {
  await runCodex(args)
} else {
  process.stderr.write(`Pixel Companion: unknown command "${command}".\n\n`)
  printUsage()
  process.exit(1)
}
