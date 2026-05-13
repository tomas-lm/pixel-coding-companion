import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { VaultConfig, VaultTreeNode } from '../../../shared/vault'
import { VaultRail } from './VaultRail'

const activeVault: VaultConfig = {
  createdAt: '2026-05-13T00:00:00.000Z',
  id: 'vault-1',
  name: 'Pixel Vault',
  rootPath: '/vault',
  updatedAt: '2026-05-13T00:00:00.000Z'
}

const tree: VaultTreeNode[] = [
  {
    children: [],
    name: 'Projects',
    path: '/vault/Projects',
    relativePath: 'Projects',
    type: 'directory'
  },
  {
    name: 'Roadmap.md',
    path: '/vault/Roadmap.md',
    relativePath: 'Roadmap.md',
    type: 'markdown'
  }
]

function renderVaultRail(
  overrides: Partial<ComponentProps<typeof VaultRail>> = {}
): ReturnType<typeof render> {
  return render(
    <VaultRail
      activeVault={activeVault}
      activeVaultId={activeVault.id}
      refreshKey={0}
      selectedFilePath={null}
      vaults={[activeVault]}
      onCreateFolder={vi.fn()}
      onCreateNote={vi.fn()}
      onDeleteEntry={vi.fn()}
      onDeleteVault={vi.fn()}
      onSaveVault={vi.fn()}
      onSelectFile={vi.fn()}
      onSelectVault={vi.fn()}
      {...overrides}
    />
  )
}

beforeEach(() => {
  Object.defineProperty(window, 'api', {
    configurable: true,
    value: {
      vault: {
        listTree: vi.fn().mockResolvedValue(tree),
        pickFolder: vi.fn(),
        pickParentFolder: vi.fn(),
        createVaultFolder: vi.fn()
      }
    }
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('VaultRail', () => {
  it('creates a folder from a folder context menu', async () => {
    const onCreateFolder = vi.fn().mockResolvedValue(undefined)

    renderVaultRail({ onCreateFolder })

    const folderButton = await screen.findByRole('button', { name: 'Projects' })
    fireEvent.contextMenu(folderButton, { clientX: 140, clientY: 160 })
    fireEvent.click(screen.getByRole('menuitem', { name: /New folder/i }))

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Clients' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create folder' }))

    await waitFor(() => {
      expect(onCreateFolder).toHaveBeenCalledWith('Clients', '/vault/Projects')
    })
  })

  it('creates a root file from the vault actions', async () => {
    const onCreateNote = vi.fn().mockResolvedValue(undefined)

    renderVaultRail({ onCreateNote })

    fireEvent.click(screen.getByRole('button', { name: 'New file' }))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Roadmap' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create file' }))

    await waitFor(() => {
      expect(onCreateNote).toHaveBeenCalledWith('Roadmap', undefined)
    })
  })

  it('deletes a folder from the folder context menu', async () => {
    const onDeleteEntry = vi.fn().mockResolvedValue(undefined)

    renderVaultRail({ onDeleteEntry })

    const folderButton = await screen.findByRole('button', { name: 'Projects' })
    fireEvent.contextMenu(folderButton, { clientX: 140, clientY: 160 })
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete folder' }))

    await waitFor(() => {
      expect(onDeleteEntry).toHaveBeenCalledWith({
        name: 'Projects',
        path: '/vault/Projects',
        type: 'directory'
      })
    })
  })

  it('deletes a file from the file context menu', async () => {
    const onDeleteEntry = vi.fn().mockResolvedValue(undefined)

    renderVaultRail({ onDeleteEntry })

    const fileButton = await screen.findByRole('button', { name: 'Roadmap.md' })
    fireEvent.contextMenu(fileButton, { clientX: 140, clientY: 180 })
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete file' }))

    await waitFor(() => {
      expect(onDeleteEntry).toHaveBeenCalledWith({
        name: 'Roadmap.md',
        path: '/vault/Roadmap.md',
        type: 'markdown'
      })
    })
  })
})
