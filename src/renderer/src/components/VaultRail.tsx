import { useEffect, useMemo, useState } from 'react'
import type { VaultConfig, VaultTreeNode } from '../../../shared/vault'
import {
  createEmptyVaultForm,
  createVaultConfig,
  filterVaultTree,
  type VaultForm
} from '../app/vaults'
import { AddButton, IconOnlyButton, RowActionButton } from './ui/IconButtons'

type VaultRailProps = {
  activeVault: VaultConfig | null
  activeVaultId: string | null
  onCreateNote: (name: string) => Promise<void>
  onCreateVault: (vault: VaultConfig) => void
  onSelectFile: (filePath: string) => void
  onSelectVault: (vaultId: string) => void
  refreshKey: number
  selectedFilePath: string | null
  vaults: VaultConfig[]
}

function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}

function getStatusMessage(error: string | null, isLoading: boolean): string | null {
  if (error) return error
  if (isLoading) return 'Loading vault...'

  return null
}

const EMPTY_VAULT_TREE: VaultTreeNode[] = []

function VaultTreeItem({
  node,
  onSelectFile,
  selectedFilePath
}: {
  node: VaultTreeNode
  onSelectFile: (filePath: string) => void
  selectedFilePath: string | null
}): React.JSX.Element {
  const [collapsed, setCollapsed] = useState(false)
  const isSelected = selectedFilePath === node.path

  if (node.type === 'markdown') {
    return (
      <li>
        <button
          className={`vault-file-button${isSelected ? ' vault-file-button--active' : ''}`}
          type="button"
          title={node.relativePath}
          onClick={() => onSelectFile(node.path)}
        >
          <span aria-hidden="true">#</span>
          <span>{node.name}</span>
        </button>
      </li>
    )
  }

  return (
    <li>
      <button
        className="vault-folder-button"
        type="button"
        title={node.relativePath}
        onClick={() => setCollapsed((current) => !current)}
      >
        <span aria-hidden="true">{collapsed ? '>' : 'v'}</span>
        <span>{node.name}</span>
      </button>
      {!collapsed && node.children && node.children.length > 0 && (
        <ul className="vault-tree-list vault-tree-list--nested">
          {node.children.map((child) => (
            <VaultTreeItem
              key={child.path}
              node={child}
              selectedFilePath={selectedFilePath}
              onSelectFile={onSelectFile}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

function VaultFormModal({
  form,
  onCancel,
  onSave
}: {
  form: VaultForm
  onCancel: () => void
  onSave: (vault: VaultConfig) => void
}): React.JSX.Element {
  const [draft, setDraft] = useState(form)
  const [error, setError] = useState<string | null>(null)
  const isExisting = draft.mode === 'existing'
  const canSave = Boolean(
    draft.name.trim() && (isExisting ? draft.rootPath.trim() : draft.parentPath.trim())
  )

  const selectFolder = async (): Promise<void> => {
    const selection = isExisting
      ? await window.api.vault.pickFolder()
      : await window.api.vault.pickParentFolder()

    if (!selection) return

    setDraft((current) => ({
      ...current,
      name: current.name || selection.name,
      parentPath: isExisting ? current.parentPath : selection.path,
      rootPath: isExisting ? selection.path : current.rootPath
    }))
  }

  const save = async (): Promise<void> => {
    if (!canSave) return

    try {
      setError(null)
      const now = new Date().toISOString()
      const root =
        draft.mode === 'new'
          ? await window.api.vault.createVaultFolder({
              name: draft.name,
              parentPath: draft.parentPath
            })
          : { name: draft.name, path: draft.rootPath }

      onSave(
        createVaultConfig({
          createId: () => createId('vault'),
          name: draft.name || root.name,
          now,
          rootPath: root.path
        })
      )
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save vault.')
    }
  }

  return (
    <div className="modal-backdrop">
      <section className="modal" aria-label={isExisting ? 'Add vault' : 'New vault'}>
        <header className="modal-header">
          <h2>{isExisting ? 'Add vault' : 'New vault'}</h2>
          <IconOnlyButton
            className="modal-close-button"
            label="Close vault settings"
            onClick={onCancel}
          >
            X
          </IconOnlyButton>
        </header>

        <label>
          <span>Name</span>
          <input
            autoFocus
            value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          />
        </label>

        <label>
          <span>{isExisting ? 'Vault folder' : 'Parent folder'}</span>
          <div className="vault-path-picker">
            <input readOnly value={isExisting ? draft.rootPath : draft.parentPath} />
            <button className="secondary-button" type="button" onClick={selectFolder}>
              Browse
            </button>
          </div>
        </label>

        {error && <div className="modal-error">{error}</div>}

        <footer className="modal-actions modal-actions--end">
          <button className="secondary-button" type="button" onClick={onCancel}>
            Cancel
          </button>
          <button className="primary-button" type="button" disabled={!canSave} onClick={save}>
            Save vault
          </button>
        </footer>
      </section>
    </div>
  )
}

function NewNoteModal({
  onCancel,
  onCreate
}: {
  onCancel: () => void
  onCreate: (name: string) => Promise<void>
}): React.JSX.Element {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const canCreate = Boolean(name.trim())

  const create = async (): Promise<void> => {
    if (!canCreate) return

    try {
      setError(null)
      await onCreate(name)
      onCancel()
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Could not create note.')
    }
  }

  return (
    <div className="modal-backdrop">
      <section className="modal" aria-label="New note">
        <header className="modal-header">
          <h2>New note</h2>
          <IconOnlyButton className="modal-close-button" label="Close new note" onClick={onCancel}>
            X
          </IconOnlyButton>
        </header>

        <label>
          <span>Name</span>
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void create()
            }}
          />
        </label>

        {error && <div className="modal-error">{error}</div>}

        <footer className="modal-actions modal-actions--end">
          <button className="secondary-button" type="button" onClick={onCancel}>
            Cancel
          </button>
          <button className="primary-button" type="button" disabled={!canCreate} onClick={create}>
            Create note
          </button>
        </footer>
      </section>
    </div>
  )
}

export function VaultRail({
  activeVault,
  activeVaultId,
  onCreateNote,
  onCreateVault,
  onSelectFile,
  onSelectVault,
  refreshKey,
  selectedFilePath,
  vaults
}: VaultRailProps): React.JSX.Element {
  const [filterQuery, setFilterQuery] = useState('')
  const [form, setForm] = useState<VaultForm | null>(null)
  const [noteFormOpen, setNoteFormOpen] = useState(false)
  const [tree, setTree] = useState<VaultTreeNode[]>([])
  const [isLoadingTree, setIsLoadingTree] = useState(false)
  const [treeError, setTreeError] = useState<string | null>(null)
  const activeTree = activeVault ? tree : EMPTY_VAULT_TREE
  const visibleTree = useMemo(
    () => filterVaultTree(activeTree, filterQuery),
    [activeTree, filterQuery]
  )
  const statusMessage = getStatusMessage(
    activeVault ? treeError : null,
    activeVault ? isLoadingTree : false
  )

  useEffect(() => {
    let mounted = true

    if (!activeVault) {
      return () => {
        mounted = false
      }
    }

    const loadTree = async (): Promise<void> => {
      setIsLoadingTree(true)
      setTreeError(null)

      try {
        const nodes = await window.api.vault.listTree({ rootPath: activeVault.rootPath })
        if (mounted) setTree(nodes)
      } catch (error) {
        if (mounted) {
          setTree([])
          setTreeError(error instanceof Error ? error.message : 'Could not load vault.')
        }
      } finally {
        if (mounted) setIsLoadingTree(false)
      }
    }

    void loadTree()

    return () => {
      mounted = false
    }
  }, [activeVault, refreshKey])

  return (
    <aside className="vault-rail">
      <div className="vault-rail-scroll">
        <div className="brand-lockup">
          <div className="brand-title-row">
            <strong>Pixel Companion</strong>
            <span className="brand-version">Vaults</span>
          </div>
        </div>

        <section className="rail-section" aria-label="Vaults">
          <div className="rail-header">
            <span>Vaults</span>
            <AddButton
              className="secondary-button"
              label="Add vault"
              onClick={() => setForm(createEmptyVaultForm('existing'))}
            />
          </div>

          <div className="vault-list">
            {vaults.length === 0 && <div className="empty-list-state">No vaults configured.</div>}

            {vaults.map((vault) => (
              <div
                key={vault.id}
                className={`vault-row${vault.id === activeVaultId ? ' vault-row--active' : ''}`}
              >
                <button
                  className="vault-item"
                  type="button"
                  onClick={() => onSelectVault(vault.id)}
                >
                  <strong>{vault.name}</strong>
                  <small>{vault.rootPath}</small>
                </button>
                <RowActionButton
                  label={`Open ${vault.name}`}
                  onClick={() => onSelectVault(vault.id)}
                >
                  ...
                </RowActionButton>
              </div>
            ))}
          </div>
        </section>

        <section className="rail-section rail-section--actions" aria-label="Vault actions">
          <button
            className="secondary-button"
            type="button"
            onClick={() => setForm(createEmptyVaultForm('new'))}
          >
            New vault
          </button>
          <button
            className="primary-button"
            type="button"
            disabled={!activeVault}
            onClick={() => setNoteFormOpen(true)}
          >
            New note
          </button>
        </section>

        <section className="rail-section vault-tree-section" aria-label="Vault files">
          <div className="rail-header">
            <span>Files</span>
            <small>{activeTree.length}</small>
          </div>

          <input
            className="vault-filter-input"
            type="search"
            placeholder="Filter files"
            value={filterQuery}
            onChange={(event) => setFilterQuery(event.target.value)}
          />

          {statusMessage && <div className="empty-list-state">{statusMessage}</div>}

          {!statusMessage && activeVault && visibleTree.length === 0 && (
            <div className="empty-list-state">No Markdown files found.</div>
          )}

          {!activeVault && <div className="empty-list-state">Select or create a vault first.</div>}

          {activeVault && visibleTree.length > 0 && (
            <ul className="vault-tree-list">
              {visibleTree.map((node) => (
                <VaultTreeItem
                  key={node.path}
                  node={node}
                  selectedFilePath={selectedFilePath}
                  onSelectFile={onSelectFile}
                />
              ))}
            </ul>
          )}
        </section>
      </div>

      {form && (
        <VaultFormModal
          form={form}
          onCancel={() => setForm(null)}
          onSave={(vault) => {
            onCreateVault(vault)
            setForm(null)
          }}
        />
      )}

      {noteFormOpen && (
        <NewNoteModal onCancel={() => setNoteFormOpen(false)} onCreate={onCreateNote} />
      )}
    </aside>
  )
}
