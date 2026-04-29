import { app, shell, BrowserWindow, dialog, ipcMain, type OpenDialogOptions } from 'electron'
import { basename, join } from 'path'
import { existsSync } from 'fs'
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
import { WORKSPACE_CHANNELS, type FolderPickResult } from '../shared/workspace'

type PtyProcess = ReturnType<typeof pty.spawn>

const terminals = new Map<TerminalSessionId, PtyProcess>()

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

      if (request.command?.trim()) {
        terminal.write(`${request.command}\r`)
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
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.on('closed', () => {
    stopAllTerminals()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

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
  electronApp.setAppUserModelId('com.electron')

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
