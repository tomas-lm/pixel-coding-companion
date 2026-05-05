import type { VaultConfig, VaultTreeNode } from '../../../shared/vault'

export type VaultFormMode = 'edit' | 'existing' | 'new'

export type VaultForm = {
  createdAt?: string
  id?: string
  lastOpenedFilePath?: string
  mode: VaultFormMode
  name: string
  parentPath: string
  rootPath: string
}

export type VaultTreeCollapseState = Record<string, boolean>

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

export function createVaultEditForm(vault: VaultConfig): VaultForm {
  return {
    createdAt: vault.createdAt,
    id: vault.id,
    lastOpenedFilePath: vault.lastOpenedFilePath,
    mode: 'edit',
    name: vault.name,
    parentPath: '',
    rootPath: vault.rootPath
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

export function toggleVaultTreeCollapseState(
  state: VaultTreeCollapseState,
  path: string
): VaultTreeCollapseState {
  const isCollapsed = state[path] ?? true

  return {
    ...state,
    [path]: !isCollapsed
  }
}

export function getVaultTreeAncestorPaths(nodes: VaultTreeNode[], targetPath: string): string[] {
  for (const node of nodes) {
    if (node.path === targetPath) return []

    const childPath = getVaultTreeAncestorPaths(node.children ?? [], targetPath)
    if (childPath.length > 0 || node.children?.some((child) => child.path === targetPath)) {
      return [node.path, ...childPath]
    }
  }

  return []
}
