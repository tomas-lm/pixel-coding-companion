import { mkdtemp, mkdir, readFile, realpath, rm, symlink, writeFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { afterEach, describe, expect, it } from 'vitest'
import {
  createMarkdownFile,
  createVaultFolder,
  isPathInside,
  listMarkdownTree,
  readMarkdownFile,
  saveMarkdownFile
} from './vaultService'

let tempDir: string | undefined

async function createTempDir(): Promise<string> {
  tempDir = await mkdtemp(join(tmpdir(), 'pixel-vault-service-'))
  return tempDir
}

afterEach(async () => {
  if (!tempDir) return

  await rm(tempDir, { force: true, recursive: true })
  tempDir = undefined
})

describe('vaultService', () => {
  it('checks path containment after resolving paths', () => {
    expect(isPathInside('/tmp/vault', '/tmp/vault/note.md')).toBe(true)
    expect(isPathInside('/tmp/vault', '/tmp/vault')).toBe(true)
    expect(isPathInside('/tmp/vault', '/tmp/vault-other/note.md')).toBe(false)
    expect(isPathInside('/tmp/vault', '/tmp/vault/../outside.md')).toBe(false)
  })

  it('lists only markdown files and folders with markdown descendants', async () => {
    const root = await createTempDir()
    await mkdir(join(root, 'notes'))
    await mkdir(join(root, 'node_modules'))
    await mkdir(join(root, 'empty'))
    await writeFile(join(root, 'notes', 'daily.md'), '# Daily')
    await writeFile(join(root, 'notes', 'ignore.txt'), 'Nope')
    await writeFile(join(root, 'node_modules', 'package.md'), '# Hidden')
    const safeRoot = await realpath(root)

    await expect(listMarkdownTree(root)).resolves.toEqual([
      {
        children: [
          {
            name: 'daily.md',
            path: join(safeRoot, 'notes', 'daily.md'),
            relativePath: 'notes/daily.md',
            type: 'markdown'
          }
        ],
        name: 'notes',
        path: join(safeRoot, 'notes'),
        relativePath: 'notes',
        type: 'directory'
      }
    ])
  })

  it('reads and saves markdown files inside the vault', async () => {
    const root = await createTempDir()
    const filePath = join(root, 'note.md')
    await writeFile(filePath, '# Note')

    await expect(readMarkdownFile(root, filePath)).resolves.toMatchObject({
      content: '# Note',
      name: 'note.md',
      relativePath: 'note.md'
    })

    await saveMarkdownFile({
      content: '# Updated',
      filePath,
      rootPath: root
    })

    await expect(readFile(filePath, 'utf8')).resolves.toBe('# Updated')
  })

  it('rejects reads outside the vault', async () => {
    const root = await createTempDir()
    const outsidePath = join(tmpdir(), `pixel-outside-${Date.now()}.md`)
    await writeFile(outsidePath, '# Outside')

    try {
      await expect(readMarkdownFile(root, outsidePath)).rejects.toThrow(
        'outside the selected vault'
      )
    } finally {
      await rm(outsidePath, { force: true })
    }
  })

  it('rejects symlink escapes when reading markdown files', async () => {
    const root = await createTempDir()
    const outsidePath = join(tmpdir(), `pixel-outside-${Date.now()}.md`)
    const linkPath = join(root, 'link.md')
    await writeFile(outsidePath, '# Outside')
    await symlink(outsidePath, linkPath)

    try {
      await expect(readMarkdownFile(root, linkPath)).rejects.toThrow('outside the selected vault')
    } finally {
      await rm(outsidePath, { force: true })
    }
  })

  it('creates markdown files and vault folders with safe names', async () => {
    const root = await createTempDir()
    const safeRoot = await realpath(root)
    const note = await createMarkdownFile({
      name: 'New Note',
      rootPath: root
    })

    expect(note.path).toBe(join(safeRoot, 'New Note.md'))
    await expect(readFile(note.path, 'utf8')).resolves.toBe('')

    const vault = await createVaultFolder({
      name: 'Nested Vault',
      parentPath: root
    })

    expect(vault).toEqual({
      name: 'Nested Vault',
      path: join(safeRoot, 'Nested Vault')
    })

    await expect(
      createMarkdownFile({
        name: '../escape',
        rootPath: root
      })
    ).rejects.toThrow('plain name')
  })
})
