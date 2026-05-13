import { mkdir, readdir, readFile, realpath, stat, writeFile } from 'fs/promises'
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from 'path'
import type {
  VaultCreateDirectoryRequest,
  VaultCreateDirectoryResult,
  VaultCreateFolderRequest,
  VaultCreateFolderResult,
  VaultCreateMarkdownFileRequest,
  VaultMarkdownFile,
  VaultSaveMarkdownFileRequest,
  VaultTreeNode
} from '../../shared/vault'

const IGNORED_DIRECTORIES = new Set([
  '.git',
  'node_modules',
  '.trash',
  'dist',
  'out',
  'build',
  'cache'
])

function isMarkdownPath(filePath: string): boolean {
  const extension = extname(filePath).toLowerCase()
  return extension === '.md' || extension === '.markdown'
}

function isIgnoredDirectory(name: string, parentPath: string): boolean {
  if (IGNORED_DIRECTORIES.has(name)) return true
  return name === 'cache' && basename(parentPath) === '.obsidian'
}

export function isPathInside(parentPath: string, candidatePath: string): boolean {
  const resolvedParent = resolve(parentPath)
  const resolvedCandidate = resolve(candidatePath)
  const pathRelation = relative(resolvedParent, resolvedCandidate)

  return (
    pathRelation === '' ||
    (!pathRelation.startsWith('..') && !isAbsolute(pathRelation) && pathRelation !== '..')
  )
}

function assertSafeSegment(name: string, label: string): string {
  const nextName = name.trim()

  if (!nextName) {
    throw new Error(`${label} is required.`)
  }

  if (nextName.includes('/') || nextName.includes('\\') || nextName === '.' || nextName === '..') {
    throw new Error(`${label} must be a plain name.`)
  }

  return nextName
}

async function getSafeExistingPath(rootPath: string, targetPath: string): Promise<string> {
  const [realRoot, realTarget] = await Promise.all([realpath(rootPath), realpath(targetPath)])

  if (!isPathInside(realRoot, realTarget)) {
    throw new Error('Path is outside the selected vault.')
  }

  return realTarget
}

async function getSafeWritablePath(rootPath: string, targetPath: string): Promise<string> {
  const realRoot = await realpath(rootPath)
  const resolvedTarget = resolve(targetPath)
  const realParent = await realpath(dirname(resolvedTarget))
  const realTarget = resolve(realParent, basename(resolvedTarget))

  if (!isPathInside(realRoot, realParent) || !isPathInside(realRoot, realTarget)) {
    throw new Error('Path is outside the selected vault.')
  }

  return realTarget
}

function getRelativePath(rootPath: string, targetPath: string): string {
  return relative(rootPath, targetPath).split(sep).join('/')
}

async function buildTree(rootPath: string, currentPath: string): Promise<VaultTreeNode | null> {
  const entries = await readdir(currentPath, { withFileTypes: true })
  const children: VaultTreeNode[] = []

  for (const entry of entries) {
    const entryPath = join(currentPath, entry.name)

    if (entry.isDirectory()) {
      if (isIgnoredDirectory(entry.name, currentPath)) continue

      const child = await buildTree(rootPath, entryPath)
      if (child) {
        children.push(child)
      }
      continue
    }

    if (entry.isFile() && isMarkdownPath(entry.name)) {
      children.push({
        name: entry.name,
        path: entryPath,
        relativePath: getRelativePath(rootPath, entryPath),
        type: 'markdown'
      })
    }
  }

  children.sort((left, right) => {
    if (left.type !== right.type) return left.type === 'directory' ? -1 : 1
    return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })
  })

  return {
    children,
    name: basename(currentPath),
    path: currentPath,
    relativePath: getRelativePath(rootPath, currentPath),
    type: 'directory'
  }
}

export async function listMarkdownTree(rootPath: string): Promise<VaultTreeNode[]> {
  const safeRoot = await getSafeExistingPath(rootPath, rootPath)
  const rootTree = await buildTree(safeRoot, safeRoot)

  return rootTree?.children ?? []
}

export async function readMarkdownFile(
  rootPath: string,
  filePath: string
): Promise<VaultMarkdownFile> {
  const safeRoot = await realpath(rootPath)
  const safePath = await getSafeExistingPath(safeRoot, filePath)

  if (!isMarkdownPath(safePath)) {
    throw new Error('Only Markdown files can be opened in vaults.')
  }

  const [content, fileStats] = await Promise.all([readFile(safePath, 'utf8'), stat(safePath)])

  return {
    content,
    name: basename(safePath),
    path: safePath,
    relativePath: getRelativePath(safeRoot, safePath),
    updatedAt: fileStats.mtime.toISOString()
  }
}

export async function saveMarkdownFile({
  content,
  filePath,
  rootPath
}: VaultSaveMarkdownFileRequest): Promise<VaultMarkdownFile> {
  const safeRoot = await realpath(rootPath)
  const safePath = await getSafeWritablePath(safeRoot, filePath)

  if (!isMarkdownPath(safePath)) {
    throw new Error('Only Markdown files can be saved in vaults.')
  }

  await writeFile(safePath, content, 'utf8')
  return readMarkdownFile(safeRoot, safePath)
}

export async function createMarkdownFile({
  directoryPath,
  name,
  rootPath
}: VaultCreateMarkdownFileRequest): Promise<VaultMarkdownFile> {
  const safeRoot = await realpath(rootPath)
  const targetDirectory = directoryPath
    ? await getSafeExistingPath(safeRoot, directoryPath)
    : safeRoot
  const baseName = assertSafeSegment(name, 'Note name')
  const fileName = isMarkdownPath(baseName) ? baseName : `${baseName}.md`
  const filePath = await getSafeWritablePath(safeRoot, join(targetDirectory, fileName))

  await writeFile(filePath, '', { encoding: 'utf8', flag: 'wx' })
  return readMarkdownFile(safeRoot, filePath)
}

export async function createFolder({
  directoryPath,
  name,
  rootPath
}: VaultCreateDirectoryRequest): Promise<VaultCreateDirectoryResult> {
  const safeRoot = await realpath(rootPath)
  const targetDirectory = directoryPath
    ? await getSafeExistingPath(safeRoot, directoryPath)
    : safeRoot
  const folderName = assertSafeSegment(name, 'Folder name')
  const folderPath = await getSafeWritablePath(safeRoot, join(targetDirectory, folderName))

  await mkdir(folderPath, { recursive: false })

  return {
    name: folderName,
    path: folderPath,
    relativePath: getRelativePath(safeRoot, folderPath)
  }
}

export async function createVaultFolder({
  name,
  parentPath
}: VaultCreateFolderRequest): Promise<VaultCreateFolderResult> {
  const safeParent = await realpath(parentPath)
  const folderName = assertSafeSegment(name, 'Vault name')
  const folderPath = resolve(safeParent, folderName)

  if (!isPathInside(safeParent, folderPath)) {
    throw new Error('Vault folder must stay inside the selected parent folder.')
  }

  await mkdir(folderPath, { recursive: false })

  return {
    name: folderName,
    path: folderPath
  }
}
