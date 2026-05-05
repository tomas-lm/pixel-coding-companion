export const VAULT_CHANNELS = {
  pickFolder: 'vault:pick-folder',
  pickParentFolder: 'vault:pick-parent-folder',
  createVaultFolder: 'vault:create-vault-folder',
  listTree: 'vault:list-tree',
  readMarkdownFile: 'vault:read-markdown-file',
  saveMarkdownFile: 'vault:save-markdown-file',
  createMarkdownFile: 'vault:create-markdown-file'
} as const

export type VaultConfig = {
  id: string
  name: string
  rootPath: string
  createdAt: string
  updatedAt: string
  lastOpenedFilePath?: string
}

export type VaultTreeNode = {
  children?: VaultTreeNode[]
  name: string
  path: string
  relativePath: string
  type: 'directory' | 'markdown'
}

export type VaultFolderPickResult = {
  name: string
  path: string
} | null

export type VaultCreateFolderRequest = {
  name: string
  parentPath: string
}

export type VaultCreateFolderResult = {
  name: string
  path: string
}

export type VaultRootRequest = {
  rootPath: string
}

export type VaultFileRequest = {
  filePath: string
  rootPath: string
}

export type VaultMarkdownFile = {
  content: string
  name: string
  path: string
  relativePath: string
  updatedAt: string
}

export type VaultSaveMarkdownFileRequest = VaultFileRequest & {
  content: string
}

export type VaultCreateMarkdownFileRequest = {
  directoryPath?: string
  name: string
  rootPath: string
}

export type VaultApi = {
  createMarkdownFile: (request: VaultCreateMarkdownFileRequest) => Promise<VaultMarkdownFile>
  createVaultFolder: (request: VaultCreateFolderRequest) => Promise<VaultCreateFolderResult>
  listTree: (request: VaultRootRequest) => Promise<VaultTreeNode[]>
  pickFolder: () => Promise<VaultFolderPickResult>
  pickParentFolder: () => Promise<VaultFolderPickResult>
  readMarkdownFile: (request: VaultFileRequest) => Promise<VaultMarkdownFile>
  saveMarkdownFile: (request: VaultSaveMarkdownFileRequest) => Promise<VaultMarkdownFile>
}
