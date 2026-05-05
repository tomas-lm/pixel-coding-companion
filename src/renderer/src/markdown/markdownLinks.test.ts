import { describe, expect, it } from 'vitest'
import type { VaultTreeNode } from '../../../shared/vault'
import {
  findWikiLinkTarget,
  normalizeWikiLinkName,
  resolveMarkdownLinkTarget,
  resolveVaultRelativePath
} from './markdownLinks'

const tree: VaultTreeNode[] = [
  {
    children: [
      {
        name: 'Daily Note.md',
        path: '/vault/Journal/Daily Note.md',
        relativePath: 'Journal/Daily Note.md',
        type: 'markdown'
      }
    ],
    name: 'Journal',
    path: '/vault/Journal',
    relativePath: 'Journal',
    type: 'directory'
  }
]

describe('markdownLinks', () => {
  it('normalizes wiki link names', () => {
    expect(normalizeWikiLinkName(' Daily   Note.md ')).toBe('daily note')
  })

  it('finds wiki link targets by filename or relative path', () => {
    expect(findWikiLinkTarget(tree, 'Daily Note')).toBe('/vault/Journal/Daily Note.md')
    expect(findWikiLinkTarget(tree, 'Journal/Daily Note')).toBe('/vault/Journal/Daily Note.md')
    expect(findWikiLinkTarget(tree, 'Missing')).toBeNull()
  })

  it('resolves local markdown links inside the vault', () => {
    expect(
      resolveMarkdownLinkTarget({
        currentFilePath: '/vault/Journal/Today.md',
        href: '../Roadmap',
        rootPath: '/vault'
      })
    ).toEqual({
      kind: 'local_markdown',
      path: '/vault/Roadmap.md'
    })
  })

  it('rejects links escaping the vault', () => {
    expect(
      resolveMarkdownLinkTarget({
        currentFilePath: '/vault/Journal/Today.md',
        href: '../../private',
        rootPath: '/vault'
      })
    ).toEqual({ kind: 'unsafe' })
  })

  it('resolves local asset paths without forcing markdown extension', () => {
    expect(
      resolveVaultRelativePath({
        currentFilePath: '/vault/Journal/Today.md',
        href: './images/a.png',
        rootPath: '/vault'
      })
    ).toBe('/vault/Journal/images/a.png')
  })
})
