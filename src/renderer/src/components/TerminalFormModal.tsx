import type { SessionKind } from '../../../shared/workspace'
import { KIND_LABELS } from '../app/sessionDisplay'
import type { TerminalForm } from '../app/terminalForms'
import { IconOnlyButton } from './ui/IconButtons'

type TerminalFormModalProps = {
  form: TerminalForm
  onChange: (form: TerminalForm) => void
  onClose: () => void
  onDelete: () => void
  onPickFolder: () => void
  onSave: () => void
}

export function TerminalFormModal({
  form,
  onChange,
  onClose,
  onDelete,
  onPickFolder,
  onSave
}: TerminalFormModalProps): React.JSX.Element {
  return (
    <div className="modal-backdrop">
      <section className="modal modal--wide" aria-label="Terminal settings">
        <header className="modal-header">
          <h2>{form.id ? 'Configure terminal' : 'Add terminal'}</h2>
          <button className="icon-button" type="button" onClick={onClose}>
            Close
          </button>
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
          <span>Type</span>
          <select
            value={form.kind}
            onChange={(event) => onChange({ ...form, kind: event.target.value as SessionKind })}
          >
            {Object.entries(KIND_LABELS).map(([kind, label]) => (
              <option key={kind} value={kind}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Folder</span>
          <div className="modal-input-with-trailing-icon">
            <input
              value={form.cwd}
              onChange={(event) => onChange({ ...form, cwd: event.target.value })}
            />
            <IconOnlyButton
              className="modal-input-trailing-button"
              label="Choose folder"
              onClick={onPickFolder}
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
        </label>
        <label>
          <span>Commands</span>
          <textarea
            rows={6}
            value={form.commandsText}
            onChange={(event) => onChange({ ...form, commandsText: event.target.value })}
          />
        </label>
        <footer className="modal-actions">
          {form.id && (
            <button className="danger-button" type="button" onClick={onDelete}>
              Delete
            </button>
          )}
          <button className="secondary-button" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-button" type="button" onClick={onSave}>
            Save terminal
          </button>
        </footer>
      </section>
    </div>
  )
}
