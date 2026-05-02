import { ipcMain } from 'electron'
import { VIEW_CHANNELS, isTerminalThemeId, type TerminalThemeId } from '../../shared/workspace'

export function registerViewIpc(onTerminalThemeSelected: (themeId: TerminalThemeId) => void): void {
  ipcMain.on(VIEW_CHANNELS.setTerminalTheme, (_, themeId: unknown) => {
    if (isTerminalThemeId(themeId)) {
      onTerminalThemeSelected(themeId)
    }
  })
}
