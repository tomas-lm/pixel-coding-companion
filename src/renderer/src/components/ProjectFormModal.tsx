import type { FolderPickResult } from '../../../shared/workspace'
import type { ProjectForm } from '../app/projectForms'
import { IconOnlyButton } from './ui/IconButtons'

type ProjectFormModalProps = {
  defaultFolderError?: string | null
  form: ProjectForm
  onChange: (form: ProjectForm) => void
  onClose: () => void
  onPickDefaultFolder: () => void
  onPickChangeRoot: () => Promise<FolderPickResult>
  onSave: () => void
}

export function ProjectFormModal({
  defaultFolderError,
  form,
  onChange,
  onClose,
  onPickDefaultFolder,
  onPickChangeRoot,
  onSave
}: ProjectFormModalProps): React.JSX.Element {
  const changeRoots = form.changeRoots ?? []

  const addChangeRoot = async (): Promise<void> => {
    const folder = await onPickChangeRoot()
    if (!folder) return
    if (changeRoots.some((root) => root.path === folder.path)) return

    onChange({
      ...form,
      changeRoots: [
        ...changeRoots,
        {
          id: `change-root-${crypto.randomUUID()}`,
          label: folder.name,
          path: folder.path
        }
      ]
    })
  }

  const removeChangeRoot = (rootId: string): void => {
    onChange({
      ...form,
      changeRoots: changeRoots.filter((root) => root.id !== rootId)
    })
  }

  return (
    <div className="modal-backdrop">
      <section className="modal modal--wide" aria-label="Workspace settings">
        <header className="modal-header">
          <h2>{form.id ? 'Edit workspace' : 'Add workspace'}</h2>
          <IconOnlyButton
            className="modal-close-button"
            label="Close workspace settings"
            onClick={onClose}
          >
            X
          </IconOnlyButton>
        </header>
        <label>
          <span>Name</span>
          <input
            value={form.name}
            autoFocus
            onChange={(event) => onChange({ ...form, name: event.target.value })}
          />
        </label>
        <label>
          <span>Description</span>
          <input
            value={form.description}
            onChange={(event) => onChange({ ...form, description: event.target.value })}
          />
        </label>
        <label>
          <span>Default folder</span>
          <div className="modal-input-with-trailing-icon">
            <input
              value={form.defaultFolder}
              onChange={(event) => onChange({ ...form, defaultFolder: event.target.value })}
              placeholder="/path/to/workspace"
            />
            <IconOnlyButton
              className="modal-input-trailing-button"
              label="Choose default folder"
              onClick={onPickDefaultFolder}
              type="button"
            >
              <svg
                viewBox="0 0 24 24"
                width={18}
                height={18}
                aria-hidden="true"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 7v11a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-7l-2-2H5a2 2 0 0 0-2 2z" />
              </svg>
            </IconOnlyButton>
          </div>
          {defaultFolderError ? (
            <p className="modal-field-error" role="alert">
              {defaultFolderError}
            </p>
          ) : null}
        </label>
        <label>
          <span>Color</span>
          <input
            type="color"
            value={form.color}
            onChange={(event) => onChange({ ...form, color: event.target.value })}
          />
        </label>
        <section className="change-roots-field" aria-labelledby="change-roots-title">
          <div className="change-roots-field__header">
            <div>
              <span id="change-roots-title">Change roots</span>
              <small>Folders whose Git changes appear in this workspace.</small>
            </div>
            <button
              className="secondary-button"
              type="button"
              onClick={() => {
                void addChangeRoot()
              }}
            >
              Add folder
            </button>
          </div>
          {changeRoots.length === 0 ? (
            <div className="change-roots-empty">No change roots configured.</div>
          ) : (
            <ul className="change-roots-list">
              {changeRoots.map((root) => (
                <li key={root.id}>
                  <span>
                    <strong>{root.label || root.path}</strong>
                    <small>{root.path}</small>
                  </span>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => removeChangeRoot(root.id)}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <footer className="modal-actions modal-actions--end">
          <button className="primary-button" type="button" onClick={onSave}>
            Save
          </button>
        </footer>
      </section>
    </div>
  )
}
