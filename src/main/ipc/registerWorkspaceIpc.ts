import { BrowserWindow, dialog, ipcMain, type OpenDialogOptions } from 'electron'
import { basename } from 'path'
import {
  WORKSPACE_CHANNELS,
  type FolderPickResult,
  type WorkspaceConfig
} from '../../shared/workspace'
import type { WorkspaceStore } from '../workspace/workspaceStore'

export function registerWorkspaceIpc(workspaceStore: WorkspaceStore): void {
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
    return workspaceStore.load()
  })

  ipcMain.handle(
    WORKSPACE_CHANNELS.saveConfig,
    async (_, config: WorkspaceConfig): Promise<void> => {
      await workspaceStore.save(config)
    }
  )
}
