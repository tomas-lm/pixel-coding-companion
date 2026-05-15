/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { randomUUID } from 'node:crypto'
import {
  getDefaultEventType,
  isValidCompanionEventType,
  writeBridgeMessage
} from './companion-bridge-state.mjs'
import { resolveProject } from './companion-project-context.mjs'

export async function createCompanionMessage(input, options) {
  const companionProfile =
    typeof options.readCompanionProfile === 'function'
      ? await options.readCompanionProfile()
      : options.companionProfile
  const resolvedProject = await resolveProject(input, options.projectContextOptions)
  const now =
    typeof options.createNow === 'function' ? options.createNow() : new Date().toISOString()
  const id = typeof options.createId === 'function' ? options.createId() : randomUUID()

  return {
    id,
    agentName: input.agentName,
    cliState: input.cliState,
    codexSessionId: input.codexSessionId,
    codexTurnId: input.codexTurnId,
    companionId: companionProfile.id,
    companionName: companionProfile.name,
    contextSource: resolvedProject.contextSource,
    createdAt: now,
    cwd: resolvedProject.cwd ?? input.cwd,
    details: input.details,
    eventType: isValidCompanionEventType(input.eventType)
      ? input.eventType
      : getDefaultEventType(input.cliState),
    hookEventName: input.hookEventName,
    projectColor: resolvedProject.projectColor,
    projectId: resolvedProject.projectId,
    projectName: resolvedProject.projectName,
    sessionName: resolvedProject.sessionName ?? input.sessionName,
    terminalColor: resolvedProject.terminalColor ?? input.terminalColor,
    terminalId: resolvedProject.terminalId,
    terminalSessionId: resolvedProject.terminalSessionId,
    source: options.source,
    summary: input.summary,
    title:
      input.title ??
      resolvedProject.sessionName ??
      input.sessionName ??
      input.agentName ??
      'CLI update'
  }
}

export async function writeCompanionMessage(message, options) {
  return writeBridgeMessage({
    dataDir: options.dataDir,
    eventsPath: options.eventsPath,
    message,
    statePath: options.statePath,
    stateOptions: {
      companionId: options.companionId,
      companionName: options.companionName,
      swallowSyntax: options.swallowSyntax
    }
  })
}

export function createCompanionReply(message, fallbackName) {
  return `${message.companionName ?? fallbackName} > ${message.summary}`
}
