import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  createCompanionDataPaths,
  findDataDirForProcessTree,
  getCompanionDataDirCandidates,
  getDataDirFromContextFile,
  getDefaultDataDir,
  resolveCompanionDataDir
} from './companion-data-dir.mjs'

describe('companion-data-dir', () => {
  it('uses PIXEL_COMPANION_DATA_DIR when provided', () => {
    expect(
      getDefaultDataDir({
        env: { PIXEL_COMPANION_DATA_DIR: '/tmp/pixel-data' },
        homeDir: '/home/tomas',
        platform: 'linux'
      })
    ).toBe('/tmp/pixel-data')
  })

  it('uses PIXEL_COMPANION_USER_DATA_DIR when provided', () => {
    expect(
      getDefaultDataDir({
        env: { PIXEL_COMPANION_USER_DATA_DIR: 'pixel-coding-companion-dev' },
        homeDir: '/Users/tomas',
        platform: 'darwin'
      })
    ).toBe('/Users/tomas/Library/Application Support/pixel-coding-companion-dev')
  })

  it('uses platform-specific defaults', () => {
    expect(getDefaultDataDir({ env: {}, homeDir: '/Users/tomas', platform: 'darwin' })).toBe(
      '/Users/tomas/Library/Application Support/pixel-coding-companion'
    )
    expect(
      getDefaultDataDir({
        env: { APPDATA: 'C:\\Users\\Tomas\\AppData\\Roaming' },
        homeDir: 'C:\\Users\\Tomas',
        platform: 'win32'
      })
    ).toBe(path.join('C:\\Users\\Tomas\\AppData\\Roaming', 'pixel-coding-companion'))
    expect(getDefaultDataDir({ env: {}, homeDir: '/home/tomas', platform: 'linux' })).toBe(
      '/home/tomas/.config/pixel-coding-companion'
    )
  })

  it('creates stable companion data paths', () => {
    expect(createCompanionDataPaths('/tmp/pixel')).toEqual({
      eventsPath: '/tmp/pixel/companion-events.jsonl',
      externalTerminalRegistryPath: '/tmp/pixel/external-terminals.json',
      progressPath: '/tmp/pixel/companion-progress.json',
      statePath: '/tmp/pixel/companion-state.json',
      terminalContextRegistryPath: '/tmp/pixel/terminal-contexts/registry.json',
      workspacesPath: '/tmp/pixel/workspaces.json'
    })
  })

  it('infers data dir from a terminal context file', () => {
    expect(getDataDirFromContextFile('/tmp/pixel-dev/terminal-contexts/session-1.json')).toBe(
      '/tmp/pixel-dev'
    )
    expect(getDataDirFromContextFile('/tmp/pixel-dev/session-1.json')).toBeUndefined()
  })

  it('orders dev candidates first when the process has a dev instance hint', () => {
    expect(
      getCompanionDataDirCandidates({
        env: { __CFBundleIdentifier: 'dev.tomasmuniz.pixel-coding-companion.dev' },
        homeDir: '/Users/tomas',
        platform: 'darwin'
      }).slice(0, 2)
    ).toEqual([
      '/Users/tomas/Library/Application Support/pixel-coding-companion-dev',
      '/Users/tomas/Library/Application Support/pixel-coding-companion'
    ])
  })

  it('resolves data dir from terminal process tree when env is unavailable', async () => {
    await expect(
      resolveCompanionDataDir({
        collectAncestorPids: async () => new Set([10, 20, 30]),
        env: {},
        homeDir: '/Users/tomas',
        platform: 'darwin',
        readRegistry: async (registryPath) =>
          registryPath.includes('pixel-coding-companion-dev')
            ? [{ sessionId: 'session-1', shellPid: 20 }]
            : []
      })
    ).resolves.toBe('/Users/tomas/Library/Application Support/pixel-coding-companion-dev')
  })

  it('chooses the newest process-tree match across candidate data dirs', async () => {
    await expect(
      findDataDirForProcessTree({
        candidateDataDirs: ['/tmp/pixel-prod', '/tmp/pixel-dev'],
        collectAncestorPids: async () => new Set([20]),
        readRegistry: async (registryPath) =>
          registryPath.includes('pixel-dev')
            ? [{ sessionId: 'session-dev', shellPid: 20, updatedAt: '2026-01-02T00:00:00.000Z' }]
            : [
                {
                  sessionId: 'session-prod',
                  shellPid: 20,
                  updatedAt: '2026-01-01T00:00:00.000Z'
                }
              ]
      })
    ).resolves.toBe('/tmp/pixel-dev')
  })

  it('keeps explicit env and context file ahead of process-tree fallback', async () => {
    await expect(
      resolveCompanionDataDir({
        collectAncestorPids: async () => new Set([20]),
        env: { PIXEL_COMPANION_DATA_DIR: '/tmp/explicit-pixel' },
        readRegistry: async () => [{ shellPid: 20 }]
      })
    ).resolves.toBe('/tmp/explicit-pixel')

    await expect(
      resolveCompanionDataDir({
        collectAncestorPids: async () => new Set([20]),
        env: { PIXEL_COMPANION_CONTEXT_FILE: '/tmp/context-pixel/terminal-contexts/session.json' },
        readRegistry: async () => [{ shellPid: 20 }]
      })
    ).resolves.toBe('/tmp/context-pixel')
  })
})
