import { BrowserWindow, screen, shell } from 'electron'
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

const COLLAPSED_OVERLAY_SIZE = { height: 42, width: 42 }

function applyOverlayWorkspaceBehavior(overlayWindow: BrowserWindow): void {
  overlayWindow.setAlwaysOnTop(true, 'screen-saver', 1)
  if (process.platform !== 'darwin') {
    overlayWindow.setVisibleOnAllWorkspaces(true)
  }
}

function getDefaultOverlayBounds(): Electron.Rectangle {
  const { workArea } = screen.getPrimaryDisplay()

  return {
    ...COLLAPSED_OVERLAY_SIZE,
    x: workArea.x + workArea.width - COLLAPSED_OVERLAY_SIZE.width - 14,
    y: workArea.y + workArea.height - COLLAPSED_OVERLAY_SIZE.height - 14
  }
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
  const initialBounds = bounds ?? getDefaultOverlayBounds()
  const overlayWindow = new BrowserWindow({
    title: `${appName} Dictation Overlay`,
    width: initialBounds.width,
    height: initialBounds.height,
    x: initialBounds.x,
    y: initialBounds.y,
    acceptFirstMouse: true,
    alwaysOnTop: true,
    hiddenInMissionControl: true,
    focusable: false,
    frame: false,
    fullscreenable: false,
    hasShadow: false,
    icon,
    maximizable: false,
    minimizable: false,
    movable: true,
    resizable: false,
    show: false,
    skipTaskbar: true,
    transparent: true,
    type: process.platform === 'darwin' ? 'panel' : undefined,
    webPreferences: {
      backgroundThrottling: false,
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  overlayWindow.excludedFromShownWindowsMenu = true
  applyOverlayWorkspaceBehavior(overlayWindow)

  overlayWindow.on('ready-to-show', () => {
    applyOverlayWorkspaceBehavior(overlayWindow)
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
