import type { VaultConfig, VaultTreeNode } from '../../../shared/vault'

export type VaultFormMode = 'existing' | 'new'

export type VaultForm = {
  mode: VaultFormMode
  name: string
  parentPath: string
  rootPath: string
}

export function normalizeVaults(vaults: VaultConfig[] | undefined): VaultConfig[] {
  if (!Array.isArray(vaults)) return []

  return vaults.filter((vault) => vault.id && vault.name.trim() && vault.rootPath.trim())
}

export function createEmptyVaultForm(mode: VaultFormMode): VaultForm {
  return {
    mode,
    name: '',
    parentPath: '',
    rootPath: ''
  }
}

export function createVaultConfig(input: {
  createId: () => string
  name: string
  now: string
  rootPath: string
}): VaultConfig {
  return {
    id: input.createId(),
    name: input.name.trim(),
    rootPath: input.rootPath,
    createdAt: input.now,
    updatedAt: input.now
  }
}

export function updateVaultLastOpenedFile(
  vaults: VaultConfig[],
  vaultId: string,
  filePath: string
): VaultConfig[] {
  const updatedAt = new Date().toISOString()

  return vaults.map((vault) =>
    vault.id === vaultId ? { ...vault, lastOpenedFilePath: filePath, updatedAt } : vault
  )
}

export function getFirstMarkdownPath(nodes: VaultTreeNode[]): string | null {
  for (const node of nodes) {
    if (node.type === 'markdown') return node.path

    const childPath = getFirstMarkdownPath(node.children ?? [])
    if (childPath) return childPath
  }

  return null
}

export function filterVaultTree(nodes: VaultTreeNode[], query: string): VaultTreeNode[] {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return nodes

  return nodes.flatMap((node) => {
    const children = filterVaultTree(node.children ?? [], normalizedQuery)
    const matches =
      node.name.toLowerCase().includes(normalizedQuery) ||
      node.relativePath.toLowerCase().includes(normalizedQuery)

    if (matches || children.length > 0) {
      if (node.type === 'directory') {
        return [{ ...node, children }]
      }

      return [node]
    }

    return []
  })
}
