/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  createCompanionMessage,
  createCompanionReply,
  writeCompanionMessage
} from './companion-message.mjs'

let tempDir

async function createPaths() {
  tempDir = await mkdtemp(path.join(os.tmpdir(), 'pixel-companion-message-'))

  return {
    dataDir: tempDir,
    eventsPath: path.join(tempDir, 'events.jsonl'),
    externalTerminalRegistryPath: path.join(tempDir, 'external-terminals.json'),
    statePath: path.join(tempDir, 'state.json'),
    terminalContextRegistryPath: path.join(tempDir, 'terminal-contexts', 'registry.json'),
    workspacesPath: path.join(tempDir, 'workspaces.json')
  }
}

afterEach(async () => {
  if (!tempDir) return

  await rm(tempDir, { force: true, recursive: true })
  tempDir = undefined
})

describe('companion-message', () => {
  it('creates messages with resolved project context and default event types', async () => {
    const paths = await createPaths()
    const message = await createCompanionMessage(
      {
        agentName: 'Codex',
        cliState: 'working',
        cwd: '/tmp/fallback',
        eventType: 'invalid',
        summary: 'Started',
        title: undefined
      },
      {
        companionProfile: { id: 'frogo', name: 'Frogo' },
        createId: () => 'message-1',
        createNow: () => '2026-05-02T10:00:00.000Z',
        projectContextOptions: {
          ...paths,
          env: {
            PIXEL_COMPANION_CWD: '/tmp/project',
            PIXEL_COMPANION_PROJECT_COLOR: '#22d3ee',
            PIXEL_COMPANION_PROJECT_ID: 'project-1',
            PIXEL_COMPANION_PROJECT_NAME: 'Pixel',
            PIXEL_COMPANION_SESSION_ID: 'session-1',
            PIXEL_COMPANION_TERMINAL_ID: 'terminal-1',
            PIXEL_COMPANION_TERMINAL_NAME: 'Dev'
          },
          pid: process.pid
        },
        source: 'app'
      }
    )

    expect(message).toMatchObject({
      companionId: 'frogo',
      companionName: 'Frogo',
      contextSource: 'env',
      createdAt: '2026-05-02T10:00:00.000Z',
      cwd: '/tmp/project',
      eventType: 'started',
      id: 'message-1',
      projectColor: '#22d3ee',
      projectId: 'project-1',
      projectName: 'Pixel',
      sessionName: 'Dev',
      source: 'app',
      terminalId: 'terminal-1',
      terminalSessionId: 'session-1',
      title: 'Dev'
    })
  })

  it('writes bridge state and event log entries', async () => {
    const paths = await createPaths()
    const message = {
      cliState: 'done',
      companionId: 'frogo',
      companionName: 'Frogo',
      createdAt: '2026-05-02T10:00:00.000Z',
      id: 'message-1',
      source: 'mcp',
      summary: 'Done',
      title: 'Codex'
    }

    const state = await writeCompanionMessage(message, {
      companionId: 'frogo',
      companionName: 'Frogo',
      dataDir: paths.dataDir,
      eventsPath: paths.eventsPath,
      statePath: paths.statePath
    })

    expect(state.messages).toHaveLength(1)
    const stateFile = JSON.parse(await readFile(paths.statePath, 'utf8'))

    expect(stateFile.currentState).toBe('done')
    await expect(readFile(paths.eventsPath, 'utf8')).resolves.toContain('"summary":"Done"')
  })

  it('creates text replies with companion fallback', () => {
    expect(createCompanionReply({ summary: 'Oi' }, 'Frogo')).toBe('Frogo > Oi')
    expect(createCompanionReply({ companionName: 'Raya', summary: 'Oi' }, 'Frogo')).toBe(
      'Raya > Oi'
    )
  })
})
