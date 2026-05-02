import { BrowserWindow, Menu, type MenuItemConstructorOptions } from 'electron'
import { VIEW_CHANNELS, TERMINAL_THEME_OPTIONS, type TerminalThemeId } from '../shared/workspace'

type RegisterAppMenuOptions = {
  appName: string
  onResetLayout: (targetWindow: BrowserWindow) => void
  onTerminalThemeSelected: (targetWindow: BrowserWindow, themeId: TerminalThemeId) => void
  selectedTerminalThemeId: TerminalThemeId
}

export function sendLayoutReset(targetWindow: BrowserWindow): void {
  if (!targetWindow.isDestroyed()) {
    targetWindow.webContents.send(VIEW_CHANNELS.resetLayout)
  }
}

export function sendTerminalThemeSelection(
  targetWindow: BrowserWindow,
  themeId: TerminalThemeId
): void {
  if (!targetWindow.isDestroyed()) {
    targetWindow.webContents.send(VIEW_CHANNELS.selectTerminalTheme, themeId)
  }
}

export function registerAppMenu(
  mainWindow: BrowserWindow,
  {
    appName,
    onResetLayout,
    onTerminalThemeSelected,
    selectedTerminalThemeId
  }: RegisterAppMenuOptions
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
          onResetLayout(BrowserWindow.getFocusedWindow() ?? mainWindow)
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
            onTerminalThemeSelected(BrowserWindow.getFocusedWindow() ?? mainWindow, theme.id)
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
