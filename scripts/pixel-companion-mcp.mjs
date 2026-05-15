#!/usr/bin/env node
/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod/v4'
import {
  CLI_STATES,
  COMPANION_EVENT_TYPES,
  MAX_MESSAGES,
  readBridgeState
} from './companion-bridge-state.mjs'
import { createCompanionDataPaths, resolveCompanionDataDir } from './companion-data-dir.mjs'
import {
  createCompanionMessage,
  createCompanionReply,
  writeCompanionMessage
} from './companion-message.mjs'
import { readWorkspaceConfig } from './companion-project-context.mjs'
import {
  getCompanionProfile,
  getCompanionReportDescription,
  getCompanionVoiceGuidance as buildCompanionVoiceGuidance,
  readActiveCompanionProfile
} from './companion-profile.mjs'
import { createActiveCompanionProgressSnapshot } from './companion-store-progress.mjs'
import { readProgress, updateCompanionProgress } from './companion-xp-awards.mjs'

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

const dataDir = await resolveCompanionDataDir()
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
const COMPANION_REPORT_DESCRIPTION = getCompanionReportDescription(COMPANION_PROFILE)
const xpAwardOptions = {
  companionName: COMPANION_NAME,
  dataDir,
  progressPath
}

function getCompanionVoiceGuidance(profile = COMPANION_PROFILE) {
  return buildCompanionVoiceGuidance(profile)
}

async function readState() {
  return readBridgeState(statePath, {
    companionId: COMPANION_ID,
    companionName: COMPANION_NAME
  })
}

async function writeMessage(message) {
  return writeCompanionMessage(message, {
    companionId: COMPANION_ID,
    companionName: COMPANION_NAME,
    dataDir,
    eventsPath,
    statePath
  })
}

async function createMessage(input) {
  return createCompanionMessage(input, {
    projectContextOptions,
    readCompanionProfile: () => readActiveCompanionProfile(dataDir),
    source: 'mcp'
  })
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
      terminalColor: z
        .string()
        .optional()
        .describe(
          'Optional fallback terminal accent color. Pixel Companion usually resolves this automatically.'
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
    const progressUpdate = await updateCompanionProgress(message, xpAwardOptions)
    const reply = createCompanionReply(message, COMPANION_NAME)

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
    const { projects, terminalConfigs } = await readWorkspaceConfig(workspacesPath)
    const projectSummaries = projects.map((project) => ({
      id: project.id,
      name: project.name,
      color: project.color,
      terminals: terminalConfigs
        .filter((config) => config.projectId === project.id)
        .map((config) => ({
          cwd: config.cwd,
          accentColor: config.accentColor,
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
    const progressState = await readProgress(xpAwardOptions)
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
