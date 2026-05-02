import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { createCompanionDataPaths, getDefaultDataDir } from './companion-data-dir.mjs'

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
})
