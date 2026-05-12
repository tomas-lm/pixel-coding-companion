import { BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { getPlatformWindowConfig } from './windowConfig'

type CreateMainWindowOptions = {
  appName: string
  icon: string
  isDev: boolean
  rendererUrl?: string
  isSafeExternalUrl: (url: string) => boolean
  onClosed: () => void
  registerMenu: (window: BrowserWindow) => void
}

function applyZoomDelta(mainWindow: BrowserWindow, delta: number): void {
  const nextZoomLevel = mainWindow.webContents.getZoomLevel() + delta
  mainWindow.webContents.setZoomLevel(nextZoomLevel)
}

function isMediaPermission(permission: string): boolean {
  return permission === 'media' || permission === 'microphone'
}

function registerWindowPermissions(mainWindow: BrowserWindow): void {
  const windowSession = mainWindow.webContents.session

  windowSession.setPermissionCheckHandler((webContents, permission) => {
    if (!isMediaPermission(permission)) return false
    return webContents === mainWindow.webContents
  })
  windowSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(isMediaPermission(permission) && webContents === mainWindow.webContents)
  })
}

export function createMainWindow(options: CreateMainWindowOptions): BrowserWindow {
  const platformWindowConfig = getPlatformWindowConfig()
  const mainWindow = new BrowserWindow({
    title: options.appName,
    width: 1180,
    height: 760,
    show: false,
    ...platformWindowConfig.windowOptions,
    icon: options.icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  platformWindowConfig.applyAfterCreate?.(mainWindow)
  registerWindowPermissions(mainWindow)

  mainWindow.on('ready-to-show', () => {
    mainWindow.setTitle(options.appName)
    mainWindow.show()
  })

  mainWindow.on('page-title-updated', (event) => {
    event.preventDefault()
    mainWindow.setTitle(options.appName)
  })

  mainWindow.on('closed', () => {
    options.onClosed()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    if (options.isSafeExternalUrl(details.url)) {
      void shell.openExternal(details.url)
    }
    return { action: 'deny' }
  })

  mainWindow.webContents.on('before-input-event', (event, input) => {
    const hasZoomModifier = process.platform === 'darwin' ? input.meta : input.control
    if (!hasZoomModifier || input.alt) return

    if (input.key === '-' || input.key === '_' || input.key === 'Subtract') {
      event.preventDefault()
      applyZoomDelta(mainWindow, -0.5)
      return
    }

    if (input.key === '+' || input.key === '=' || input.key === 'Add') {
      event.preventDefault()
      applyZoomDelta(mainWindow, 0.5)
      return
    }

    if (input.key === '0') {
      event.preventDefault()
      mainWindow.webContents.setZoomLevel(0)
    }
  })

  options.registerMenu(mainWindow)

  if (options.isDev && options.rendererUrl) {
    mainWindow.loadURL(options.rendererUrl)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}
