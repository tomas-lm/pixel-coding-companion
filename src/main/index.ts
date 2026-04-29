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
import { mkdir, readFile, writeFile } from 'fs/promises'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import * as pty from 'node-pty'
import icon from '../../resources/icon.png?asset'
import {
  TERMINAL_CHANNELS,
  type TerminalInputRequest,
  type TerminalResizeRequest,
  type TerminalSessionId,
  type TerminalStartRequest,
  type TerminalStartResponse
} from '../shared/terminal'
import {
  VIEW_CHANNELS,
  WORKSPACE_CHANNELS,
  type FolderPickResult,
  type WorkspaceConfig
} from '../shared/workspace'

type PtyProcess = ReturnType<typeof pty.spawn>

const APP_NAME = 'Pixel Companion'
const APP_ID = 'dev.tomasmuniz.pixel-coding-companion'
const APP_USER_DATA_DIR = 'pixel-coding-companion'
const terminals = new Map<TerminalSessionId, PtyProcess>()

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

function getPtyEnv(): Record<string, string> {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string'
    )
  )

  return {
    ...env,
    TERM: 'xterm-256color',
    COLORTERM: 'truecolor'
  }
}

function getWorkspaceConfigPath(): string {
  return join(app.getPath('userData'), 'workspaces.json')
}

function stopTerminal(id: TerminalSessionId): void {
  const terminal = terminals.get(id)
  if (!terminal) return

  terminals.delete(id)
  terminal.kill()
}

function stopAllTerminals(): void {
  for (const id of terminals.keys()) {
    stopTerminal(id)
  }
}

function registerTerminalIpc(): void {
  ipcMain.handle(
    TERMINAL_CHANNELS.start,
    (event, request: TerminalStartRequest): TerminalStartResponse => {
      stopTerminal(request.id)

      const shellPath = getDefaultShell()
      const cwd = getSafeCwd(request.cwd)
      const terminal = pty.spawn(shellPath, [], {
        name: 'xterm-256color',
        cols: Math.max(request.cols, 2),
        rows: Math.max(request.rows, 2),
        cwd,
        env: getPtyEnv()
      })

      terminals.set(request.id, terminal)

      terminal.onData((data) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send(TERMINAL_CHANNELS.data, { id: request.id, data })
        }
      })

      terminal.onExit(({ exitCode, signal }) => {
        terminals.delete(request.id)
        if (!event.sender.isDestroyed()) {
          event.sender.send(TERMINAL_CHANNELS.exit, { id: request.id, exitCode, signal })
        }
      })

      const commands = request.commands?.map((command) => command.trim()).filter(Boolean) ?? []
      if (commands.length > 0) {
        commands.forEach((command, index) => {
          setTimeout(() => {
            if (terminals.get(request.id) === terminal) {
              terminal.write(`${command}\r`)
            }
          }, index * 80)
        })
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
    terminals.get(request.id)?.write(request.data)
  })

  ipcMain.on(TERMINAL_CHANNELS.resize, (_, request: TerminalResizeRequest) => {
    const terminal = terminals.get(request.id)
    if (!terminal) return

    terminal.resize(Math.max(request.cols, 2), Math.max(request.rows, 2))
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

function sendLayoutReset(targetWindow: BrowserWindow): void {
  if (!targetWindow.isDestroyed()) {
    targetWindow.webContents.send(VIEW_CHANNELS.resetLayout)
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
    ...(process.platform === 'linux' ? { icon } : {}),
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
    shell.openExternal(details.url)
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

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerTerminalIpc()
  registerWorkspaceIpc()

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
