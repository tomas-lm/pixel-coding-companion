import { BrowserWindow, Menu, type MenuItemConstructorOptions } from 'electron'
import { VIEW_CHANNELS } from '../shared/workspace'

type RegisterAppMenuOptions = {
  appName: string
  onResetLayout: (targetWindow: BrowserWindow) => void
}

function getMenuTargetWindow(mainWindow: BrowserWindow): BrowserWindow {
  return BrowserWindow.getFocusedWindow() ?? mainWindow
}

function resetZoom(mainWindow: BrowserWindow): void {
  const targetWindow = getMenuTargetWindow(mainWindow)
  targetWindow.webContents.setZoomLevel(0)
}

function increaseZoom(mainWindow: BrowserWindow): void {
  const targetWindow = getMenuTargetWindow(mainWindow)
  const nextZoomLevel = targetWindow.webContents.getZoomLevel() + 0.5
  targetWindow.webContents.setZoomLevel(nextZoomLevel)
}

function decreaseZoom(mainWindow: BrowserWindow): void {
  const targetWindow = getMenuTargetWindow(mainWindow)
  const nextZoomLevel = targetWindow.webContents.getZoomLevel() - 0.5
  targetWindow.webContents.setZoomLevel(nextZoomLevel)
}

export function sendLayoutReset(targetWindow: BrowserWindow): void {
  if (!targetWindow.isDestroyed()) {
    targetWindow.webContents.send(VIEW_CHANNELS.resetLayout)
  }
}

export function registerAppMenu(
  mainWindow: BrowserWindow,
  { appName, onResetLayout }: RegisterAppMenuOptions
): void {
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
          onResetLayout(getMenuTargetWindow(mainWindow))
        }
      },
      { type: 'separator' },
      { role: 'reload' },
      { role: 'forceReload' },
      { role: 'toggleDevTools' },
      { type: 'separator' },
      {
        label: 'Actual size',
        accelerator: 'CommandOrControl+0',
        click: () => {
          resetZoom(mainWindow)
        }
      },
      {
        label: 'Zoom in',
        accelerator: 'CommandOrControl+=',
        click: () => {
          increaseZoom(mainWindow)
        }
      },
      {
        label: 'Zoom out',
        accelerator: 'CommandOrControl+-',
        click: () => {
          decreaseZoom(mainWindow)
        }
      },
      { type: 'separator' },
      { role: 'togglefullscreen' }
    ]
  }
  const template: MenuItemConstructorOptions[] = [
    ...(process.platform === 'darwin'
      ? [
          {
            label: appName,
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
