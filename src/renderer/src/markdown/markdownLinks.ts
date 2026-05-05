import type { VaultTreeNode } from '../../../shared/vault'

export type MarkdownLinkTarget =
  | {
      kind: 'external'
      url: string
    }
  | {
      kind: 'local_markdown'
      path: string
    }
  | {
      kind: 'unsafe'
    }

function normalizeAbsolutePath(path: string): string {
  const isAbsolute = path.startsWith('/')
  const parts: string[] = []

  for (const segment of path.split('/')) {
    if (!segment || segment === '.') continue
    if (segment === '..') {
      parts.pop()
      continue
    }
    parts.push(segment)
  }

  return `${isAbsolute ? '/' : ''}${parts.join('/')}`
}

function ensureMarkdownExtension(path: string): string {
  return /\.(md|markdown)$/i.test(path) ? path : `${path}.md`
}

function getDirectoryPath(path: string): string {
  const index = path.lastIndexOf('/')
  return index === -1 ? '' : path.slice(0, index)
}

export function isExternalMarkdownLink(href: string): boolean {
  return /^(https?:|mailto:)/i.test(href.trim())
}

export function resolveVaultRelativePath(input: {
  currentFilePath: string
  href: string
  rootPath: string
}): string | null {
  const href = input.href.trim()
  if (!href || isExternalMarkdownLink(href)) return null

  const pathWithoutHash = href.split('#')[0]
  if (!pathWithoutHash) return null

  const rootPath = normalizeAbsolutePath(input.rootPath)
  const basePath = pathWithoutHash.startsWith('/')
    ? `${rootPath}/${pathWithoutHash.slice(1)}`
    : `${getDirectoryPath(input.currentFilePath)}/${pathWithoutHash}`
  const normalizedPath = normalizeAbsolutePath(basePath)
  const rootPrefix = rootPath.endsWith('/') ? rootPath : `${rootPath}/`

  if (normalizedPath !== rootPath && !normalizedPath.startsWith(rootPrefix)) {
    return null
  }

  return normalizedPath
}

export function resolveMarkdownLinkTarget(input: {
  currentFilePath: string
  href: string
  rootPath: string
}): MarkdownLinkTarget {
  const href = input.href.trim()
  if (!href) return { kind: 'unsafe' }

  if (isExternalMarkdownLink(href)) {
    return {
      kind: 'external',
      url: href
    }
  }

  const resolvedPath = resolveVaultRelativePath(input)
  if (!resolvedPath) return { kind: 'unsafe' }

  return {
    kind: 'local_markdown',
    path: ensureMarkdownExtension(resolvedPath)
  }
}

export function normalizeWikiLinkName(name: string): string {
  return name
    .trim()
    .replace(/\.(md|markdown)$/i, '')
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

export function findWikiLinkTarget(nodes: VaultTreeNode[], wikiName: string): string | null {
  const expected = normalizeWikiLinkName(wikiName)

  for (const node of nodes) {
    if (node.type === 'markdown') {
      const name = normalizeWikiLinkName(node.name)
      const relativePath = normalizeWikiLinkName(node.relativePath)

      if (name === expected || relativePath === expected) {
        return node.path
      }
    }

    const childTarget = findWikiLinkTarget(node.children ?? [], wikiName)
    if (childTarget) return childTarget
  }

  return null
}
