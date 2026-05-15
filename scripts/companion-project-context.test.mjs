/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { writeJsonAtomic } from './companion-json-store.mjs'
import {
  getExternalTerminalColor,
  getNextExternalTerminalNumber,
  readProcessTreeContext,
  readWorkspaceConfig,
  resolveProject
} from './companion-project-context.mjs'

let tempDir

async function createPaths() {
  tempDir = await mkdtemp(path.join(os.tmpdir(), 'pixel-project-context-'))

  return {
    externalTerminalRegistryPath: path.join(tempDir, 'external-terminals.json'),
    terminalContextRegistryPath: path.join(tempDir, 'terminal-contexts', 'registry.json'),
    workspacesPath: path.join(tempDir, 'workspaces.json')
  }
}

afterEach(async () => {
  if (!tempDir) return

  await rm(tempDir, { force: true, recursive: true })
  tempDir = undefined
})

describe('companion-project-context', () => {
  it('loads workspace config with empty fallback', async () => {
    const paths = await createPaths()

    await expect(readWorkspaceConfig(paths.workspacesPath)).resolves.toEqual({
      projects: [],
      terminalConfigs: []
    })
  })

  it('resolves explicit environment context before workspace lookup', async () => {
    const paths = await createPaths()

    await expect(
      resolveProject(
        { cwd: '/tmp/fallback', projectColor: '#111111' },
        {
          ...paths,
          env: {
            PIXEL_COMPANION_CWD: '/tmp/project',
            PIXEL_COMPANION_PROJECT_COLOR: '#4ea1ff',
            PIXEL_COMPANION_PROJECT_ID: 'project-1',
            PIXEL_COMPANION_PROJECT_NAME: 'Pixel',
            PIXEL_COMPANION_SESSION_ID: 'session-1',
            PIXEL_COMPANION_TERMINAL_ID: 'terminal-1',
            PIXEL_COMPANION_TERMINAL_NAME: 'Dev'
          },
          pid: process.pid
        }
      )
    ).resolves.toMatchObject({
      contextSource: 'env',
      cwd: '/tmp/project',
      projectColor: '#4ea1ff',
      projectId: 'project-1',
      projectName: 'Pixel',
      sessionName: 'Dev',
      terminalId: 'terminal-1',
      terminalSessionId: 'session-1'
    })
  })

  it('resolves workspace project metadata', async () => {
    const paths = await createPaths()
    await writeJsonAtomic(paths.workspacesPath, {
      projects: [{ color: '#22d3ee', id: 'project-1', name: 'Pixel' }],
      terminalConfigs: []
    })

    await expect(
      resolveProject(
        { cwd: '/tmp/project', projectId: 'project-1' },
        { ...paths, env: {}, pid: process.pid }
      )
    ).resolves.toMatchObject({
      contextSource: 'workspace',
      cwd: '/tmp/project',
      projectColor: '#22d3ee',
      projectId: 'project-1',
      projectName: 'Pixel'
    })
  })

  it('prefers the newest matching process-tree context', async () => {
    const paths = await createPaths()
    await writeJsonAtomic(paths.terminalContextRegistryPath, [
      {
        projectId: 'project-old',
        projectName: 'Old',
        sessionId: 'session-old',
        shellPid: process.pid,
        terminalName: 'Old Terminal',
        updatedAt: '2026-01-01T00:00:00.000Z'
      },
      {
        projectId: 'project-new',
        projectName: 'New',
        sessionId: 'session-new',
        shellPid: process.pid,
        terminalName: 'New Terminal',
        updatedAt: '2026-01-02T00:00:00.000Z'
      }
    ])

    await expect(
      readProcessTreeContext({
        pid: process.pid,
        terminalContextRegistryPath: paths.terminalContextRegistryPath
      })
    ).resolves.toMatchObject({
      contextSource: 'process_tree',
      projectId: 'project-new',
      sessionId: 'session-new',
      terminalName: 'New Terminal'
    })
  })

  it('numbers and colors external terminals deterministically', () => {
    expect(getNextExternalTerminalNumber([{ name: 'Terminal 1' }, { name: 'Terminal 2' }])).toBe(3)
    expect(getExternalTerminalColor(1, [{ color: '#ff8bd1' }])).toBe('#f97316')
  })
})
