import {
  app,
  shell,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  type MenuItemConstructorOptions,
  type OpenDialogOptions
} from 'electron'
import { basename, join } from 'path'
import { existsSync } from 'fs'
import { mkdir, readFile, rename, writeFile } from 'fs/promises'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import * as pty from 'node-pty'
import icon from '../../resources/icon.png?asset'
import { openTarget, isSafeExternalUrl } from './openTarget'
import {
  COMPANION_CHANNELS,
  type CompanionBridgeMessage,
  type CompanionBridgeState,
  type CompanionProgressState
} from '../shared/companion'
import { SYSTEM_CHANNELS, type OpenTargetRequest, type OpenTargetResult } from '../shared/system'
import {
  TERMINAL_CHANNELS,
  type TerminalCompanionContext,
  type TerminalInputRequest,
  type TerminalResizeRequest,
  type TerminalSessionId,
  type TerminalStartRequest,
  type TerminalStartResponse
} from '../shared/terminal'
import {
  DEFAULT_TERMINAL_THEME_ID,
  TERMINAL_THEME_OPTIONS,
  VIEW_CHANNELS,
  WORKSPACE_CHANNELS,
  type FolderPickResult,
  isTerminalThemeId,
  type TerminalThemeId,
  type WorkspaceConfig
} from '../shared/workspace'

type PtyProcess = ReturnType<typeof pty.spawn>
type ManagedTerminal = {
  autoLaunchInput?: string
  autoLaunchInputSent: boolean
  pendingData: string
  process: PtyProcess
}

type TerminalContextRegistryEntry = TerminalCompanionContext & {
  shellPid: number
  startedAt: string
  updatedAt: string
}

const APP_NAME = 'Pixel Companion'
const APP_ID = 'dev.tomasmuniz.pixel-coding-companion'
const APP_USER_DATA_DIR = 'pixel-coding-companion'
const COMMAND_EXIT_MARKER = '__PIXEL_COMPANION_COMMAND_EXIT__:'
const COMMAND_EXIT_COMMAND = `printf '\\n${COMMAND_EXIT_MARKER}%s\\n' "$?"`
const COMMAND_EXIT_PATTERN = new RegExp(
  `(?:\\r?\\n)?${COMMAND_EXIT_MARKER}(-?\\d+)(?:\\r?\\n)?`,
  'g'
)
const AUTO_LAUNCH_FALLBACK_DELAY_MS = 7000
const AUTO_LAUNCH_SUBMIT_DELAY_MS = 180
const ANSI_SEQUENCE_PATTERN = new RegExp(`${String.fromCharCode(27)}\\[[0-9;?]*[ -/]*[@-~]`, 'g')
const CODEX_CLI_READY_PATTERNS = [/Tip: Use \/skills/i, /›\s*$/]
const CODEX_START_COMMAND_PATTERN = /^codex(?:\s|$)/
const PIXEL_CODEX_START_COMMAND_PATTERN =
  /^(?:pixel\s+codex|node\s+.+pixel\.mjs['"]?\s+codex)(?:\s|$)/
const COMPANION_MAX_LEVEL = 100
const COMPANION_BASE_NEXT_LEVEL_XP = 120
const COMPANION_LEVEL_XP_GROWTH = 1.13
const terminals = new Map<TerminalSessionId, ManagedTerminal>()
let selectedTerminalThemeId: TerminalThemeId = DEFAULT_TERMINAL_THEME_ID
let terminalContextRegistryQueue: Promise<void> = Promise.resolve()

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
    TERM_PROGRAM: 'PixelCompanion'
  }

  delete nextEnv.NO_COLOR
  return nextEnv
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`
}

function getPixelCliCommand(): string {
  const candidates = [
    join(process.cwd(), 'scripts', 'pixel.mjs'),
    join(app.getAppPath(), 'scripts', 'pixel.mjs')
  ]
  const scriptPath = candidates.find((candidate) => existsSync(candidate))

  return scriptPath ? `node ${shellQuote(scriptPath)}` : 'pixel'
}

function wrapCommandWithPixel(command: string, startWithPixel?: boolean): string {
  const trimmedCommand = command.trim()

  if (!startWithPixel) return trimmedCommand
  if (!CODEX_START_COMMAND_PATTERN.test(trimmedCommand)) return trimmedCommand
  if (PIXEL_CODEX_START_COMMAND_PATTERN.test(trimmedCommand)) return trimmedCommand

  return `${getPixelCliCommand()} ${trimmedCommand}`
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

function getTerminalCompanionContextPath(sessionId: TerminalSessionId): string {
  return join(app.getPath('userData'), 'terminal-contexts', `${sessionId}.json`)
}

function getTerminalContextRegistryPath(): string {
  return join(app.getPath('userData'), 'terminal-contexts', 'registry.json')
}

async function writeTerminalCompanionContext(
  sessionId: TerminalSessionId,
  context?: TerminalCompanionContext
): Promise<Record<string, string>> {
  if (!context) return {}

  const contextPath = getTerminalCompanionContextPath(sessionId)
  const contextFile = {
    ...context,
    sessionId,
    updatedAt: new Date().toISOString()
  }

  await mkdir(join(app.getPath('userData'), 'terminal-contexts'), { recursive: true })
  await writeFile(contextPath, `${JSON.stringify(contextFile, null, 2)}\n`, 'utf8')

  return {
    PIXEL_COMPANION_CONTEXT_FILE: contextPath,
    PIXEL_COMPANION_CWD: context.cwd ?? '',
    PIXEL_COMPANION_PROJECT_COLOR: context.projectColor,
    PIXEL_COMPANION_PROJECT_ID: context.projectId,
    PIXEL_COMPANION_PROJECT_NAME: context.projectName,
    PIXEL_COMPANION_SESSION_ID: sessionId,
    PIXEL_COMPANION_TERMINAL_ID: context.terminalId,
    PIXEL_COMPANION_TERMINAL_NAME: context.terminalName
  }
}

async function readTerminalContextRegistry(): Promise<TerminalContextRegistryEntry[]> {
  try {
    const file = await readFile(getTerminalContextRegistryPath(), 'utf8')
    const registry = JSON.parse(file)

    return Array.isArray(registry) ? (registry as TerminalContextRegistryEntry[]) : []
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    if (error instanceof SyntaxError) return []
    throw error
  }
}

async function writeTerminalContextRegistry(
  registry: TerminalContextRegistryEntry[]
): Promise<void> {
  await mkdir(join(app.getPath('userData'), 'terminal-contexts'), { recursive: true })
  const registryPath = getTerminalContextRegistryPath()
  const tempPath = `${registryPath}.${process.pid}.${Date.now()}.tmp`

  await writeFile(tempPath, `${JSON.stringify(registry, null, 2)}\n`, 'utf8')
  await rename(tempPath, registryPath)
}

async function updateTerminalContextRegistry(
  updater: (registry: TerminalContextRegistryEntry[]) => TerminalContextRegistryEntry[]
): Promise<void> {
  const update = terminalContextRegistryQueue.then(async () => {
    const registry = await readTerminalContextRegistry()
    await writeTerminalContextRegistry(updater(registry))
  })

  terminalContextRegistryQueue = update.catch(() => undefined)
  await update
}

async function registerTerminalContextProcess(
  sessionId: TerminalSessionId,
  shellPid: number,
  context?: TerminalCompanionContext
): Promise<void> {
  if (!context) return

  const now = new Date().toISOString()
  await updateTerminalContextRegistry((registry) => {
    const nextRegistry = registry.filter((entry) => entry.sessionId !== sessionId)

    nextRegistry.push({
      ...context,
      sessionId,
      shellPid,
      startedAt: now,
      updatedAt: now
    })

    return nextRegistry
  })
}

async function unregisterTerminalContextProcess(sessionId: TerminalSessionId): Promise<void> {
  await updateTerminalContextRegistry((registry) =>
    registry.filter((entry) => entry.sessionId !== sessionId)
  )
}

function createDefaultCompanionBridgeState(): CompanionBridgeState {
  return {
    currentState: 'idle',
    messages: []
  }
}

function getXpRequiredForLevel(level: number): number {
  const safeLevel = Math.min(Math.max(Math.floor(level), 0), COMPANION_MAX_LEVEL)

  return Math.floor(COMPANION_BASE_NEXT_LEVEL_XP * Math.pow(COMPANION_LEVEL_XP_GROWTH, safeLevel))
}

function createDefaultCompanionProgressState(): CompanionProgressState {
  const xpForNextLevel = getXpRequiredForLevel(0)

  return {
    currentXp: 0,
    level: 0,
    maxLevel: COMPANION_MAX_LEVEL,
    name: 'Ghou',
    progressRatio: 0,
    totalXp: 0,
    xpForNextLevel
  }
}

function normalizeCompanionBridgeState(value: unknown): CompanionBridgeState {
  if (!value || typeof value !== 'object') return createDefaultCompanionBridgeState()

  const state = value as Partial<CompanionBridgeState>
  const messages = Array.isArray(state.messages)
    ? (state.messages.filter((message) => {
        if (!message || typeof message !== 'object') return false

        const candidate = message as Partial<CompanionBridgeMessage>
        return (
          typeof candidate.id === 'string' &&
          typeof candidate.createdAt === 'string' &&
          typeof candidate.title === 'string' &&
          typeof candidate.summary === 'string'
        )
      }) as CompanionBridgeMessage[])
    : []

  return {
    currentState: state.currentState ?? 'idle',
    messages: messages.slice(-80),
    updatedAt: state.updatedAt
  }
}

function normalizeCompanionProgressState(value: unknown): CompanionProgressState {
  if (!value || typeof value !== 'object') return createDefaultCompanionProgressState()

  const state = value as Partial<CompanionProgressState>
  const level =
    typeof state.level === 'number' && Number.isFinite(state.level)
      ? Math.min(Math.max(Math.floor(state.level), 0), COMPANION_MAX_LEVEL)
      : 0
  const xpForNextLevel =
    typeof state.xpForNextLevel === 'number' && Number.isFinite(state.xpForNextLevel)
      ? Math.max(0, Math.floor(state.xpForNextLevel))
      : getXpRequiredForLevel(level)
  const currentXp =
    typeof state.currentXp === 'number' && Number.isFinite(state.currentXp)
      ? Math.min(Math.max(Math.floor(state.currentXp), 0), xpForNextLevel)
      : 0

  return {
    currentXp,
    level,
    maxLevel: COMPANION_MAX_LEVEL,
    name: typeof state.name === 'string' && state.name.trim() ? state.name.trim() : 'Ghou',
    progressRatio: xpForNextLevel > 0 ? currentXp / xpForNextLevel : 1,
    totalXp:
      typeof state.totalXp === 'number' && Number.isFinite(state.totalXp)
        ? Math.max(0, Math.floor(state.totalXp))
        : currentXp,
    updatedAt: typeof state.updatedAt === 'string' ? state.updatedAt : undefined,
    xpForNextLevel
  }
}

function stopTerminal(id: TerminalSessionId): void {
  const managedTerminal = terminals.get(id)
  if (!managedTerminal) return

  terminals.delete(id)
  void unregisterTerminalContextProcess(id)
  managedTerminal.process.kill()
}

function stopAllTerminals(): void {
  for (const id of terminals.keys()) {
    stopTerminal(id)
  }
}

function getMarkerPrefixLength(data: string): number {
  const maxLength = Math.min(COMMAND_EXIT_MARKER.length - 1, data.length)

  for (let length = maxLength; length > 0; length -= 1) {
    if (COMMAND_EXIT_MARKER.startsWith(data.slice(-length))) return length
  }

  return 0
}

function writeStartupCommands(
  terminal: PtyProcess,
  id: TerminalSessionId,
  commands: string[],
  options: { writeExitMarker: boolean }
): void {
  commands.forEach((command, index) => {
    setTimeout(() => {
      if (terminals.get(id)?.process === terminal) {
        terminal.write(`${command}\r`)
      }
    }, index * 80)
  })

  if (!options.writeExitMarker) return

  setTimeout(() => {
    if (terminals.get(id)?.process === terminal) {
      terminal.write(`${COMMAND_EXIT_COMMAND}\r`)
    }
  }, commands.length * 80)
}

function isCodexCliReady(output: string): boolean {
  const plainOutput = output.replace(ANSI_SEQUENCE_PATTERN, '')
  return CODEX_CLI_READY_PATTERNS.some((pattern) => pattern.test(plainOutput))
}

function writeAutoLaunchInput(terminal: PtyProcess, id: TerminalSessionId): void {
  const managedTerminal = terminals.get(id)
  if (!managedTerminal?.autoLaunchInput || managedTerminal.autoLaunchInputSent) return

  managedTerminal.autoLaunchInputSent = true
  terminal.write(managedTerminal.autoLaunchInput)

  setTimeout(() => {
    if (terminals.get(id)?.process === terminal) {
      terminal.write('\r')
    }
  }, AUTO_LAUNCH_SUBMIT_DELAY_MS)
}

function writeAutoLaunchInputIfCodexReady(
  terminal: PtyProcess,
  id: TerminalSessionId,
  output: string
): void {
  if (!isCodexCliReady(output)) return

  setTimeout(() => {
    if (terminals.get(id)?.process === terminal) {
      writeAutoLaunchInput(terminal, id)
    }
  }, 350)
}

function scheduleAutoLaunchInputFallback(
  terminal: PtyProcess,
  id: TerminalSessionId,
  commandCount: number
): void {
  const delayMs = commandCount * 120 + AUTO_LAUNCH_FALLBACK_DELAY_MS

  setTimeout(() => {
    if (terminals.get(id)?.process === terminal) {
      writeAutoLaunchInput(terminal, id)
    }
  }, delayMs)
}

function registerTerminalIpc(): void {
  ipcMain.handle(
    TERMINAL_CHANNELS.start,
    async (event, request: TerminalStartRequest): Promise<TerminalStartResponse> => {
      stopTerminal(request.id)

      const shellPath = getDefaultShell()
      const cwd = getSafeCwd(request.cwd)
      const contextEnv = await writeTerminalCompanionContext(request.id, request.companionContext)
      const terminal = pty.spawn(shellPath, [], {
        name: 'xterm-256color',
        cols: Math.max(request.cols, 2),
        rows: Math.max(request.rows, 2),
        cwd,
        env: getPtyEnv({
          ...(request.env ?? {}),
          ...contextEnv
        })
      })
      await registerTerminalContextProcess(request.id, terminal.pid, request.companionContext)

      terminals.set(request.id, {
        autoLaunchInput: request.autoLaunchInput?.trim() || undefined,
        autoLaunchInputSent: false,
        pendingData: '',
        process: terminal
      })

      terminal.onData((data) => {
        const managedTerminal = terminals.get(request.id)
        if (!managedTerminal) return

        const combinedData = managedTerminal.pendingData + data
        let visibleData = ''
        let lastIndex = 0

        for (const match of combinedData.matchAll(COMMAND_EXIT_PATTERN)) {
          visibleData += combinedData.slice(lastIndex, match.index)
          lastIndex = match.index + match[0].length

          if (!event.sender.isDestroyed()) {
            event.sender.send(TERMINAL_CHANNELS.commandExit, {
              id: request.id,
              exitCode: Number(match[1])
            })
          }
        }

        visibleData += combinedData.slice(lastIndex)
        visibleData = visibleData.replaceAll(COMMAND_EXIT_COMMAND, '')

        const pendingLength = getMarkerPrefixLength(visibleData)
        managedTerminal.pendingData = pendingLength > 0 ? visibleData.slice(-pendingLength) : ''
        visibleData = pendingLength > 0 ? visibleData.slice(0, -pendingLength) : visibleData

        writeAutoLaunchInputIfCodexReady(terminal, request.id, visibleData)

        if (!event.sender.isDestroyed()) {
          event.sender.send(TERMINAL_CHANNELS.data, { id: request.id, data: visibleData })
        }
      })

      terminal.onExit(({ exitCode, signal }) => {
        terminals.delete(request.id)
        void unregisterTerminalContextProcess(request.id)
        if (!event.sender.isDestroyed()) {
          event.sender.send(TERMINAL_CHANNELS.exit, { id: request.id, exitCode, signal })
        }
      })

      const commands =
        request.commands
          ?.map((command) => wrapCommandWithPixel(command, request.startWithPixel))
          .filter(Boolean) ?? []
      if (commands.length > 0) {
        writeStartupCommands(terminal, request.id, commands, {
          writeExitMarker: !request.suppressCommandExitMarker
        })
      }

      if (request.autoLaunchInput) {
        scheduleAutoLaunchInputFallback(terminal, request.id, commands.length)
      }

      return {
        id: request.id,
        pid: terminal.pid,
        shell: shellPath,
        cwd
      }
    }
  )

  ipcMain.handle(TERMINAL_CHANNELS.stop, (_, id: TerminalSessionId) => {
    stopTerminal(id)
  })

  ipcMain.on(TERMINAL_CHANNELS.input, (_, request: TerminalInputRequest) => {
    terminals.get(request.id)?.process.write(request.data)
  })

  ipcMain.on(TERMINAL_CHANNELS.resize, (_, request: TerminalResizeRequest) => {
    const managedTerminal = terminals.get(request.id)
    if (!managedTerminal) return

    managedTerminal.process.resize(Math.max(request.cols, 2), Math.max(request.rows, 2))
  })
}

function registerWorkspaceIpc(): void {
  ipcMain.handle(WORKSPACE_CHANNELS.pickFolder, async (event): Promise<FolderPickResult> => {
    const owner = BrowserWindow.fromWebContents(event.sender)
    const options: OpenDialogOptions = {
      title: 'Add project folder',
      properties: ['openDirectory', 'createDirectory']
    }
    const result = owner
      ? await dialog.showOpenDialog(owner, options)
      : await dialog.showOpenDialog(options)

    if (result.canceled || result.filePaths.length === 0) return null

    const folderPath = result.filePaths[0]
    return {
      name: basename(folderPath),
      path: folderPath
    }
  })

  ipcMain.handle(WORKSPACE_CHANNELS.loadConfig, async (): Promise<WorkspaceConfig | null> => {
    try {
      const file = await readFile(getWorkspaceConfigPath(), 'utf8')
      return JSON.parse(file) as WorkspaceConfig
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw error
    }
  })

  ipcMain.handle(
    WORKSPACE_CHANNELS.saveConfig,
    async (_, config: WorkspaceConfig): Promise<void> => {
      const configPath = getWorkspaceConfigPath()
      await mkdir(app.getPath('userData'), { recursive: true })
      await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8')
    }
  )
}

function registerViewIpc(): void {
  ipcMain.on(VIEW_CHANNELS.setTerminalTheme, (_, themeId: unknown) => {
    if (isTerminalThemeId(themeId)) {
      updateTerminalThemeMenu(themeId)
    }
  })
}

function registerCompanionIpc(): void {
  ipcMain.handle(COMPANION_CHANNELS.loadBridgeState, async (): Promise<CompanionBridgeState> => {
    try {
      const file = await readFile(getCompanionBridgeStatePath(), 'utf8')
      return normalizeCompanionBridgeState(JSON.parse(file))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return createDefaultCompanionBridgeState()
      }

      throw error
    }
  })

  ipcMain.handle(COMPANION_CHANNELS.loadProgress, async (): Promise<CompanionProgressState> => {
    try {
      const file = await readFile(getCompanionProgressPath(), 'utf8')
      return normalizeCompanionProgressState(JSON.parse(file))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return createDefaultCompanionProgressState()
      }

      throw error
    }
  })
}

function registerSystemIpc(): void {
  ipcMain.handle(
    SYSTEM_CHANNELS.openTarget,
    async (_, request: OpenTargetRequest): Promise<OpenTargetResult> => openTarget(request)
  )
}

function sendLayoutReset(targetWindow: BrowserWindow): void {
  if (!targetWindow.isDestroyed()) {
    targetWindow.webContents.send(VIEW_CHANNELS.resetLayout)
  }
}

function updateTerminalThemeMenu(themeId: TerminalThemeId): void {
  selectedTerminalThemeId = themeId

  const mainWindow = BrowserWindow.getAllWindows().find((window) => !window.isDestroyed())
  if (mainWindow) {
    registerAppMenu(mainWindow)
  }
}

function sendTerminalThemeSelection(targetWindow: BrowserWindow, themeId: TerminalThemeId): void {
  updateTerminalThemeMenu(themeId)

  if (!targetWindow.isDestroyed()) {
    targetWindow.webContents.send(VIEW_CHANNELS.selectTerminalTheme, themeId)
  }
}

function registerAppMenu(mainWindow: BrowserWindow): void {
  const editMenu: MenuItemConstructorOptions = {
    label: 'Edit',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'selectAll' }
    ]
  }
  const viewMenu: MenuItemConstructorOptions = {
    label: 'View',
    submenu: [
      {
        label: 'Reset default',
        click: () => {
          sendLayoutReset(BrowserWindow.getFocusedWindow() ?? mainWindow)
        }
      },
      {
        label: 'Themes:',
        submenu: TERMINAL_THEME_OPTIONS.map((theme) => ({
          id: `terminal-theme:${theme.id}`,
          label: theme.label,
          type: 'checkbox',
          checked: theme.id === selectedTerminalThemeId,
          click: () => {
            sendTerminalThemeSelection(BrowserWindow.getFocusedWindow() ?? mainWindow, theme.id)
          }
        }))
      },
      { type: 'separator' },
      { role: 'reload' },
      { role: 'forceReload' },
      { role: 'toggleDevTools' },
      { type: 'separator' },
      { role: 'resetZoom' },
      { role: 'zoomIn' },
      { role: 'zoomOut' },
      { type: 'separator' },
      { role: 'togglefullscreen' }
    ]
  }
  const template: MenuItemConstructorOptions[] = [
    ...(process.platform === 'darwin'
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              { role: 'services' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' }
            ]
          } satisfies MenuItemConstructorOptions
        ]
      : []),
    editMenu,
    viewMenu,
    { role: 'windowMenu' }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    title: APP_NAME,
    width: 1180,
    height: 760,
    show: false,
    autoHideMenuBar: false,
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.setTitle(APP_NAME)
    mainWindow.show()
  })

  mainWindow.on('page-title-updated', (event) => {
    event.preventDefault()
    mainWindow.setTitle(APP_NAME)
  })

  mainWindow.on('closed', () => {
    stopAllTerminals()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    if (isSafeExternalUrl(details.url)) {
      void shell.openExternal(details.url)
    }
    return { action: 'deny' }
  })

  registerAppMenu(mainWindow)

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId(APP_ID)
  if (process.platform === 'darwin' && app.dock) {
    app.dock.setIcon(icon)
  }
  void writeTerminalContextRegistry([])

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerTerminalIpc()
  registerWorkspaceIpc()
  registerViewIpc()
  registerCompanionIpc()
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
  stopAllTerminals()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
