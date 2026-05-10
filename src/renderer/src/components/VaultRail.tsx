import { useEffect, useMemo, useState } from 'react'
import type { VaultConfig, VaultTreeNode } from '../../../shared/vault'
import {
  createEmptyVaultForm,
  createVaultConfig,
  createVaultEditForm,
  filterVaultTree,
  toggleVaultTreeCollapseState,
  type VaultTreeCollapseState,
  type VaultForm
} from '../app/vaults'
import { IconOnlyButton, RowActionButton } from './ui/IconButtons'

type VaultRailProps = {
  activeVault: VaultConfig | null
  activeVaultId: string | null
  onCreateNote: (name: string) => Promise<void>
  onDeleteVault: (vaultId: string) => void
  onSaveVault: (vault: VaultConfig) => void
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

function ChevronIcon({ collapsed }: { collapsed: boolean }): React.JSX.Element {
  return (
    <svg
      aria-hidden="true"
      className={`vault-tree-chevron${collapsed ? '' : ' vault-tree-chevron--open'}`}
      viewBox="0 0 16 16"
    >
      <path d="M6 4.5 9.5 8 6 11.5" />
    </svg>
  )
}

function FolderTreeIcon({ open }: { open: boolean }): React.JSX.Element {
  return (
    <svg
      aria-hidden="true"
      className={`vault-tree-icon vault-tree-icon--folder${open ? ' vault-tree-icon--open' : ''}`}
      viewBox="0 0 18 18"
    >
      <path d="M2.5 5.5h5l1.3 1.6h6.7v6.4a1 1 0 0 1-1 1h-12a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1Z" />
      <path d="M2.5 5.5V4.7a1 1 0 0 1 1-1h3.1l1.1 1.8" />
    </svg>
  )
}

function MarkdownFileIcon(): React.JSX.Element {
  return (
    <svg aria-hidden="true" className="vault-tree-icon vault-tree-icon--file" viewBox="0 0 18 18">
      <path d="M5 2.5h5.5L14 6v9.5H5a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1Z" />
      <path d="M10.5 2.8V6H14" />
      <path d="M6.5 9h5M6.5 11.5h4" />
    </svg>
  )
}

function VaultTreeItem({
  collapsedPaths,
  filterActive,
  node,
  onSelectFile,
  onToggleFolder,
  selectedFilePath
}: {
  collapsedPaths: VaultTreeCollapseState
  filterActive: boolean
  node: VaultTreeNode
  onSelectFile: (filePath: string) => void
  onToggleFolder: (path: string) => void
  selectedFilePath: string | null
}): React.JSX.Element {
  const isSelected = selectedFilePath === node.path
  const collapsed = !filterActive && (collapsedPaths[node.path] ?? true)

  if (node.type === 'markdown') {
    return (
      <li>
        <button
          className={`vault-file-button${isSelected ? ' vault-file-button--active' : ''}`}
          type="button"
          title={node.relativePath}
          aria-current={isSelected ? 'page' : undefined}
          onClick={() => onSelectFile(node.path)}
        >
          <span aria-hidden="true" className="vault-tree-spacer" />
          <MarkdownFileIcon />
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
        aria-expanded={!collapsed}
        onClick={() => onToggleFolder(node.path)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowRight' && collapsed) {
            event.preventDefault()
            onToggleFolder(node.path)
          }

          if (event.key === 'ArrowLeft' && !collapsed) {
            event.preventDefault()
            onToggleFolder(node.path)
          }
        }}
      >
        <ChevronIcon collapsed={collapsed} />
        <FolderTreeIcon open={!collapsed} />
        <span>{node.name}</span>
      </button>
      {!collapsed && node.children && node.children.length > 0 && (
        <ul className="vault-tree-list vault-tree-list--nested">
          {node.children.map((child) => (
            <VaultTreeItem
              key={child.path}
              collapsedPaths={collapsedPaths}
              filterActive={filterActive}
              node={child}
              selectedFilePath={selectedFilePath}
              onSelectFile={onSelectFile}
              onToggleFolder={onToggleFolder}
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
  onDelete,
  onSave
}: {
  form: VaultForm
  onCancel: () => void
  onDelete: (vaultId: string) => void
  onSave: (vault: VaultConfig) => void
}): React.JSX.Element {
  const [draft, setDraft] = useState(form)
  const [error, setError] = useState<string | null>(null)
  const isExisting = draft.mode === 'existing'
  const isEdit = draft.mode === 'edit'
  const canSave = Boolean(
    draft.name.trim() && (isExisting || isEdit ? draft.rootPath.trim() : draft.parentPath.trim())
  )

  const selectFolder = async (): Promise<void> => {
    const selection =
      isExisting || isEdit
        ? await window.api.vault.pickFolder()
        : await window.api.vault.pickParentFolder()

    if (!selection) return

    setDraft((current) => ({
      ...current,
      name: current.name || selection.name,
      parentPath: isExisting || isEdit ? current.parentPath : selection.path,
      rootPath: isExisting || isEdit ? selection.path : current.rootPath
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

      if (isEdit && draft.id && draft.createdAt) {
        onSave({
          id: draft.id,
          name: draft.name.trim() || root.name,
          rootPath: root.path,
          createdAt: draft.createdAt,
          updatedAt: now,
          lastOpenedFilePath: form.rootPath === root.path ? draft.lastOpenedFilePath : undefined
        })
        return
      }

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

  const remove = (): void => {
    if (!draft.id) return

    onDelete(draft.id)
    onCancel()
  }

  return (
    <div className="modal-backdrop">
      <section
        className="modal"
        aria-label={isEdit ? 'Edit vault' : isExisting ? 'Add existing vault' : 'New vault'}
      >
        <header className="modal-header">
          <h2>{isEdit ? 'Edit vault' : isExisting ? 'Add existing vault' : 'New vault'}</h2>
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
          <span>{isExisting || isEdit ? 'Vault folder' : 'Parent folder'}</span>
          <div className="vault-path-picker">
            <input readOnly value={isExisting || isEdit ? draft.rootPath : draft.parentPath} />
            <button className="secondary-button" type="button" onClick={selectFolder}>
              Browse
            </button>
          </div>
        </label>

        {error && <div className="modal-error">{error}</div>}

        <footer className="modal-actions">
          <div>
            {isEdit && (
              <button className="danger-button" type="button" onClick={remove}>
                Remove
              </button>
            )}
          </div>
          <div className="modal-actions modal-actions--inline">
            <button className="secondary-button" type="button" onClick={onCancel}>
              Cancel
            </button>
            <button className="primary-button" type="button" disabled={!canSave} onClick={save}>
              {isEdit ? 'Update vault' : 'Save vault'}
            </button>
          </div>
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
  onDeleteVault,
  onSaveVault,
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
  const [collapsedPaths, setCollapsedPaths] = useState<VaultTreeCollapseState>({})
  const [isLoadingTree, setIsLoadingTree] = useState(false)
  const [treeError, setTreeError] = useState<string | null>(null)
  const activeTree = activeVault ? tree : EMPTY_VAULT_TREE
  const visibleTree = useMemo(
    () => filterVaultTree(activeTree, filterQuery),
    [activeTree, filterQuery]
  )
  const filterActive = filterQuery.trim().length > 0
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
            <span className="brand-version">v1.0.0</span>
          </div>
        </div>

        <section className="rail-section" aria-label="Vaults">
          <div className="rail-header">
            <span>Vaults</span>
            <small>{vaults.length}</small>
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
                  label={`Edit ${vault.name}`}
                  onClick={() => setForm(createVaultEditForm(vault))}
                >
                  ...
                </RowActionButton>
              </div>
            ))}
          </div>
        </section>

        <section className="rail-section rail-section--actions" aria-label="Vault actions">
          <div className="vault-action-grid">
            <button
              className="secondary-button"
              type="button"
              onClick={() => setForm(createEmptyVaultForm('existing'))}
            >
              Add existing
            </button>
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
          </div>
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
                  collapsedPaths={collapsedPaths}
                  filterActive={filterActive}
                  node={node}
                  selectedFilePath={selectedFilePath}
                  onSelectFile={onSelectFile}
                  onToggleFolder={(path) =>
                    setCollapsedPaths((currentState) =>
                      toggleVaultTreeCollapseState(currentState, path)
                    )
                  }
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
          onDelete={onDeleteVault}
          onSave={(vault) => {
            onSaveVault(vault)
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
