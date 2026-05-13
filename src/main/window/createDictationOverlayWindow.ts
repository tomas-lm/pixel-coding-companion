import { BrowserWindow, shell } from 'electron'
import { join } from 'path'

type CreateDictationOverlayWindowOptions = {
  appName: string
  bounds?: Electron.Rectangle
  icon: string
  isDev: boolean
  isSafeExternalUrl: (url: string) => boolean
  onBoundsChanged: (bounds: Electron.Rectangle) => void
  onClosed: () => void
  rendererUrl?: string
}

export function createDictationOverlayWindow({
  appName,
  bounds,
  icon,
  isDev,
  isSafeExternalUrl,
  onBoundsChanged,
  onClosed,
  rendererUrl
}: CreateDictationOverlayWindowOptions): BrowserWindow {
  const overlayWindow = new BrowserWindow({
    title: `${appName} Dictation Overlay`,
    width: bounds?.width ?? 320,
    height: bounds?.height ?? 88,
    x: bounds?.x,
    y: bounds?.y,
    alwaysOnTop: true,
    frame: false,
    fullscreenable: false,
    hasShadow: false,
    icon,
    maximizable: false,
    minimizable: false,
    resizable: false,
    show: false,
    skipTaskbar: true,
    transparent: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  overlayWindow.setAlwaysOnTop(true, 'floating')
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  overlayWindow.on('ready-to-show', () => {
    overlayWindow.showInactive()
  })
  overlayWindow.on('move', () => {
    onBoundsChanged(overlayWindow.getBounds())
  })
  overlayWindow.on('closed', onClosed)

  overlayWindow.webContents.setWindowOpenHandler((details) => {
    if (isSafeExternalUrl(details.url)) {
      void shell.openExternal(details.url)
    }
    return { action: 'deny' }
  })

  if (isDev && rendererUrl) {
    const overlayUrl = new URL(rendererUrl)
    overlayUrl.searchParams.set('view', 'dictation-overlay')
    overlayWindow.loadURL(overlayUrl.toString())
  } else {
    overlayWindow.loadFile(join(__dirname, '../renderer/index.html'), {
      query: { view: 'dictation-overlay' }
    })
  }

  return overlayWindow
}
