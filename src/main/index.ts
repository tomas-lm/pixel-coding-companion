import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { registerAppMenu, sendLayoutReset, sendTerminalThemeSelection } from './appMenu'
import { CompanionBridgeStore } from './companion/companionBridgeStore'
import { CompanionStoreService } from './companion/companionStoreService'
import { registerCompanionIpc } from './ipc/registerCompanionIpc'
import { registerSystemIpc } from './ipc/registerSystemIpc'
import { registerTerminalIpc } from './ipc/registerTerminalIpc'
import { registerViewIpc } from './ipc/registerViewIpc'
import { registerWorkspaceIpc } from './ipc/registerWorkspaceIpc'
import { isSafeExternalUrl } from './openTarget'
import { TerminalContextRegistry } from './terminal/terminalContextRegistry'
import { TerminalManager } from './terminal/terminalManager'
import { createMainWindow } from './window/createMainWindow'
import { WorkspaceStore } from './workspace/workspaceStore'
import { DEFAULT_TERMINAL_THEME_ID, type TerminalThemeId } from '../shared/workspace'

function readEnvSetting(name: string): string | undefined {
  const value = process.env[name]?.trim()

  return value ? value : undefined
}

const APP_NAME = readEnvSetting('PIXEL_COMPANION_APP_NAME') ?? 'Pixel Companion'
const APP_ID = readEnvSetting('PIXEL_COMPANION_APP_ID') ?? 'dev.tomasmuniz.pixel-coding-companion'
const APP_USER_DATA_DIR =
  readEnvSetting('PIXEL_COMPANION_USER_DATA_DIR') ?? 'pixel-coding-companion'
let selectedTerminalThemeId: TerminalThemeId = DEFAULT_TERMINAL_THEME_ID
const terminalContextRegistry = new TerminalContextRegistry(() => app.getPath('userData'))
const terminalManager = new TerminalManager({
  broadcastTerminalEvent,
  contextRegistry: terminalContextRegistry,
  getDefaultShell,
  getPixelCliCommandPaths: () => ({
    appPath: app.getAppPath(),
    cwd: process.cwd(),
    resourcesPath: process.resourcesPath
  }),
  getPtyEnv,
  getSafeCwd
})
const companionBridgeStore = new CompanionBridgeStore(getCompanionBridgeStatePath)
const companionStoreService = new CompanionStoreService(
  getCompanionProgressPath,
  getCompanionStoreStatePath
)
const workspaceStore = new WorkspaceStore(getWorkspaceConfigPath)

app.setName(APP_NAME)
// Keep persisted workspace data independent from the display name shown by macOS.
app.setPath('userData', join(app.getPath('appData'), APP_USER_DATA_DIR))

function getDefaultShell(): string {
  if (process.platform === 'win32') return process.env.ComSpec ?? 'powershell.exe'
  return process.env.SHELL ?? '/bin/zsh'
}

function getSafeCwd(cwd?: string): string {
  if (cwd && existsSync(cwd)) return cwd
  return app.getPath('home')
}

function getPtyEnv(extraEnv: Record<string, string> = {}): Record<string, string> {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string'
    )
  )

  const nextEnv: Record<string, string> = {
    ...env,
    ...extraEnv,
    TERM: 'xterm-256color',
    COLORTERM: 'truecolor',
    CLICOLOR: '1',
    CLICOLOR_FORCE: '1',
    FORCE_COLOR: '3',
    PIXEL_COMPANION_DATA_DIR: app.getPath('userData'),
    TERM_PROGRAM: 'PixelCompanion'
  }

  delete nextEnv.NO_COLOR
  return nextEnv
}

function getWorkspaceConfigPath(): string {
  return join(app.getPath('userData'), 'workspaces.json')
}

function getCompanionBridgeStatePath(): string {
  return join(app.getPath('userData'), 'companion-state.json')
}

function getCompanionProgressPath(): string {
  return join(app.getPath('userData'), 'companion-progress.json')
}

function getCompanionStoreStatePath(): string {
  return join(app.getPath('userData'), 'companion-store.json')
}

function broadcastTerminalEvent(channel: string, data: unknown): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.webContents.isDestroyed()) {
      window.webContents.send(channel, data)
    }
  }
}

function registerMainWindowMenu(mainWindow: BrowserWindow): void {
  registerAppMenu(mainWindow, {
    appName: APP_NAME,
    onResetLayout: sendLayoutReset,
    onTerminalThemeSelected: (targetWindow, themeId) => {
      updateTerminalThemeMenu(themeId)
      sendTerminalThemeSelection(targetWindow, themeId)
    },
    selectedTerminalThemeId
  })
}

function updateTerminalThemeMenu(themeId: TerminalThemeId): void {
  selectedTerminalThemeId = themeId

  const mainWindow = BrowserWindow.getAllWindows().find((window) => !window.isDestroyed())
  if (mainWindow) {
    registerMainWindowMenu(mainWindow)
  }
}

function createWindow(): void {
  createMainWindow({
    appName: APP_NAME,
    icon,
    isDev: is.dev,
    rendererUrl: process.env['ELECTRON_RENDERER_URL'],
    isSafeExternalUrl,
    onClosed: () => {
      terminalManager.stopAll()
    },
    registerMenu: registerMainWindowMenu
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId(APP_ID)
  app.setAboutPanelOptions({
    applicationName: APP_NAME,
    applicationVersion: app.getVersion(),
    version: app.getVersion()
  })
  if (process.platform === 'darwin' && app.dock) {
    app.dock.setIcon(icon)
  }
  void terminalContextRegistry.clear()

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerTerminalIpc(terminalManager)
  registerWorkspaceIpc(workspaceStore)
  registerViewIpc(updateTerminalThemeMenu)
  registerCompanionIpc(companionBridgeStore, companionStoreService)
  registerSystemIpc()

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  terminalManager.stopAll()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
