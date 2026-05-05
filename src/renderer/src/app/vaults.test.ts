import { describe, expect, it } from 'vitest'
import type { VaultConfig, VaultTreeNode } from '../../../shared/vault'
import {
  createEmptyVaultForm,
  createVaultConfig,
  filterVaultTree,
  getFirstMarkdownPath,
  getVaultTreeAncestorPaths,
  normalizeVaults,
  toggleVaultTreeCollapseState,
  updateVaultLastOpenedFile
} from './vaults'

const tree: VaultTreeNode[] = [
  {
    children: [
      {
        name: 'Daily.md',
        path: '/vault/Journal/Daily.md',
        relativePath: 'Journal/Daily.md',
        type: 'markdown'
      }
    ],
    name: 'Journal',
    path: '/vault/Journal',
    relativePath: 'Journal',
    type: 'directory'
  },
  {
    name: 'Roadmap.md',
    path: '/vault/Roadmap.md',
    relativePath: 'Roadmap.md',
    type: 'markdown'
  }
]

describe('vaults helpers', () => {
  it('normalizes saved vault configs', () => {
    const vaults: VaultConfig[] = [
      {
        createdAt: '2026-05-05T00:00:00.000Z',
        id: 'vault-1',
        name: 'Tomas',
        rootPath: '/vault',
        updatedAt: '2026-05-05T00:00:00.000Z'
      },
      {
        createdAt: '2026-05-05T00:00:00.000Z',
        id: '',
        name: '',
        rootPath: '',
        updatedAt: '2026-05-05T00:00:00.000Z'
      }
    ]

    expect(normalizeVaults(vaults)).toEqual([vaults[0]])
  })

  it('creates empty forms for both modes', () => {
    expect(createEmptyVaultForm('existing')).toMatchObject({
      mode: 'existing',
      name: '',
      rootPath: ''
    })
    expect(createEmptyVaultForm('new')).toMatchObject({
      mode: 'new',
      name: '',
      parentPath: ''
    })
  })

  it('creates vault configs with timestamps', () => {
    expect(
      createVaultConfig({
        createId: () => 'vault-1',
        name: ' Tomas ',
        now: '2026-05-05T00:00:00.000Z',
        rootPath: '/vault'
      })
    ).toEqual({
      createdAt: '2026-05-05T00:00:00.000Z',
      id: 'vault-1',
      name: 'Tomas',
      rootPath: '/vault',
      updatedAt: '2026-05-05T00:00:00.000Z'
    })
  })

  it('finds the first markdown path in tree order', () => {
    expect(getFirstMarkdownPath(tree)).toBe('/vault/Journal/Daily.md')
  })

  it('filters tree nodes by name or relative path', () => {
    expect(filterVaultTree(tree, 'journal')).toEqual([tree[0]])
    expect(filterVaultTree(tree, 'road')).toEqual([tree[1]])
    expect(filterVaultTree(tree, 'missing')).toEqual([])
  })

  it('updates the last opened file for one vault', () => {
    const updated = updateVaultLastOpenedFile(
      [
        {
          createdAt: '2026-05-05T00:00:00.000Z',
          id: 'vault-1',
          name: 'Vault 1',
          rootPath: '/vault-1',
          updatedAt: '2026-05-05T00:00:00.000Z'
        },
        {
          createdAt: '2026-05-05T00:00:00.000Z',
          id: 'vault-2',
          name: 'Vault 2',
          rootPath: '/vault-2',
          updatedAt: '2026-05-05T00:00:00.000Z'
        }
      ],
      'vault-1',
      '/vault-1/note.md'
    )

    expect(updated[0]).toMatchObject({
      id: 'vault-1',
      lastOpenedFilePath: '/vault-1/note.md'
    })
    expect(updated[1]?.lastOpenedFilePath).toBeUndefined()
  })

  it('toggles folder collapse state', () => {
    expect(toggleVaultTreeCollapseState({}, '/vault/Journal')).toEqual({
      '/vault/Journal': true
    })
    expect(toggleVaultTreeCollapseState({ '/vault/Journal': true }, '/vault/Journal')).toEqual({
      '/vault/Journal': false
    })
  })

  it('finds ancestors for active file reveal', () => {
    expect(getVaultTreeAncestorPaths(tree, '/vault/Journal/Daily.md')).toEqual(['/vault/Journal'])
    expect(getVaultTreeAncestorPaths(tree, '/vault/Roadmap.md')).toEqual([])
  })
})
