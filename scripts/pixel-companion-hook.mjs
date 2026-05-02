#!/usr/bin/env node
/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { createCompanionDataPaths, getDefaultDataDir } from './companion-data-dir.mjs'
import { createCompanionMessage, writeCompanionMessage } from './companion-message.mjs'
import { readBoundContext } from './companion-project-context.mjs'
import {
  getCompanionVoiceGuidance as buildCompanionVoiceGuidance,
  readActiveCompanionProfile
} from './companion-profile.mjs'
import {
  shouldSuppressFallbackFinalMessage,
  updateCompanionProgress
} from './companion-xp-awards.mjs'
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
const projectContextOptions = {
  externalTerminalRegistryPath,
  terminalContextRegistryPath,
  workspacesPath
}
const xpAwardOptions = {
  companionName: COMPANION_NAME,
  dataDir,
  progressPath
}

function getCompanionVoiceGuidance() {
  return buildCompanionVoiceGuidance(COMPANION_PROFILE)
}

function truncate(value, maxLength) {
  const text = String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  if (text.length <= maxLength) return text

  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`
}

async function writeMessage(message) {
  return writeCompanionMessage(message, {
    companionId: COMPANION_ID,
    companionName: COMPANION_NAME,
    dataDir,
    eventsPath,
    statePath,
    swallowSyntax: true
  })
}

async function createMessage(input) {
  return createCompanionMessage(input, {
    companionProfile: COMPANION_PROFILE,
    projectContextOptions,
    source: 'app'
  })
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
  const context = await readBoundContext(projectContextOptions)
  const terminalName = getSessionLabel(context, hookInput)
  const projectName = getProjectLabel(context)
  const additionalContext = [
    '[Pixel Companion setup]',
    'This is startup context, not a user task.',
    `You are running inside Pixel Companion terminal "${terminalName}" for "${projectName}".`,
    `Active companion: ${COMPANION_NAME}. ${getCompanionVoiceGuidance()}`,
    'Use the pixel-companion MCP companion_report tool when meaningful work starts, finishes, fails, or needs user input.',
    'If context was reset or cleared, use companion_get_profile to recover the active companion personality and reporting contract.',
    `Write ${COMPANION_NAME} messages as natural user-facing speech. Match the user language and communication style.`,
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
  const context = await readBoundContext(projectContextOptions)
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
  await updateCompanionProgress(message, xpAwardOptions)

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
  const context = await readBoundContext(projectContextOptions)
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

  if (await shouldSuppressFallbackFinalMessage(message, xpAwardOptions)) {
    return {
      continue: true
    }
  }

  await writeMessage(message)
  await updateCompanionProgress(message, { ...xpAwardOptions, suppressFallbackFinal: true })

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
