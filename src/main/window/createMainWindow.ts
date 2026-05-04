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

  options.registerMenu(mainWindow)

  if (options.isDev && options.rendererUrl) {
    mainWindow.loadURL(options.rendererUrl)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}
