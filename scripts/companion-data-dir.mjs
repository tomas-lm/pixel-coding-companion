/* eslint-disable @typescript-eslint/explicit-function-return-type */

import os from 'node:os'
import path from 'node:path'

export function getDefaultDataDir({
  env = process.env,
  homeDir = os.homedir(),
  platform = process.platform
} = {}) {
  if (env.PIXEL_COMPANION_DATA_DIR) return env.PIXEL_COMPANION_DATA_DIR
  if (platform === 'darwin') {
    return path.join(homeDir, 'Library/Application Support/pixel-coding-companion')
  }
  if (platform === 'win32') {
    return path.join(env.APPDATA ?? homeDir, 'pixel-coding-companion')
  }

  return path.join(env.XDG_CONFIG_HOME ?? path.join(homeDir, '.config'), 'pixel-coding-companion')
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
