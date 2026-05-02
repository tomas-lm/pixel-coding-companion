import type { ProjectForm } from '../app/projectForms'
import { IconOnlyButton } from './ui/IconButtons'

type ProjectFormModalProps = {
  form: ProjectForm
  onChange: (form: ProjectForm) => void
  onClose: () => void
  onSave: () => void
}

export function ProjectFormModal({
  form,
  onChange,
  onClose,
  onSave
}: ProjectFormModalProps): React.JSX.Element {
  return (
    <div className="modal-backdrop">
      <section className="modal" aria-label="Workspace settings">
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
          <span>Color</span>
          <input
            type="color"
            value={form.color}
            onChange={(event) => onChange({ ...form, color: event.target.value })}
          />
        </label>
        <footer className="modal-actions modal-actions--end">
          <button className="primary-button" type="button" onClick={onSave}>
            Save
          </button>
        </footer>
      </section>
    </div>
  )
}
