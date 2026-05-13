import { BrowserWindow, dialog, type OpenDialogOptions, ipcMain } from 'electron'
import { basename } from 'path'
import {
  createFolder,
  createMarkdownFile,
  createVaultFolder,
  listMarkdownTree,
  readMarkdownFile,
  saveMarkdownFile
} from '../vault/vaultService'
import {
  VAULT_CHANNELS,
  type VaultCreateDirectoryRequest,
  type VaultCreateDirectoryResult,
  type VaultCreateFolderRequest,
  type VaultCreateFolderResult,
  type VaultCreateMarkdownFileRequest,
  type VaultFileRequest,
  type VaultFolderPickResult,
  type VaultMarkdownFile,
  type VaultRootRequest,
  type VaultSaveMarkdownFileRequest,
  type VaultTreeNode
} from '../../shared/vault'

async function pickFolder(
  event: Electron.IpcMainInvokeEvent,
  title: string
): Promise<VaultFolderPickResult> {
  const owner = BrowserWindow.fromWebContents(event.sender)
  const options: OpenDialogOptions = {
    title,
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
}

export function registerVaultIpc(): void {
  ipcMain.handle(VAULT_CHANNELS.pickFolder, async (event): Promise<VaultFolderPickResult> => {
    return pickFolder(event, 'Add vault folder')
  })

  ipcMain.handle(VAULT_CHANNELS.pickParentFolder, async (event): Promise<VaultFolderPickResult> => {
    return pickFolder(event, 'Choose parent folder')
  })

  ipcMain.handle(
    VAULT_CHANNELS.createVaultFolder,
    async (_, request: VaultCreateFolderRequest): Promise<VaultCreateFolderResult> => {
      return createVaultFolder(request)
    }
  )

  ipcMain.handle(
    VAULT_CHANNELS.createFolder,
    async (_, request: VaultCreateDirectoryRequest): Promise<VaultCreateDirectoryResult> => {
      return createFolder(request)
    }
  )

  ipcMain.handle(
    VAULT_CHANNELS.listTree,
    async (_, request: VaultRootRequest): Promise<VaultTreeNode[]> => {
      return listMarkdownTree(request.rootPath)
    }
  )

  ipcMain.handle(
    VAULT_CHANNELS.readMarkdownFile,
    async (_, request: VaultFileRequest): Promise<VaultMarkdownFile> => {
      return readMarkdownFile(request.rootPath, request.filePath)
    }
  )

  ipcMain.handle(
    VAULT_CHANNELS.saveMarkdownFile,
    async (_, request: VaultSaveMarkdownFileRequest): Promise<VaultMarkdownFile> => {
      return saveMarkdownFile(request)
    }
  )

  ipcMain.handle(
    VAULT_CHANNELS.createMarkdownFile,
    async (_, request: VaultCreateMarkdownFileRequest): Promise<VaultMarkdownFile> => {
      return createMarkdownFile(request)
    }
  )
}
