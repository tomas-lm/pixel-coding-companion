import type { SessionKind } from '../../../shared/workspace'
import { KIND_LABELS } from '../app/sessionDisplay'
import type { TerminalForm } from '../app/terminalForms'

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
          <div className="input-row">
            <input
              value={form.cwd}
              onChange={(event) => onChange({ ...form, cwd: event.target.value })}
            />
            <button className="secondary-button" type="button" onClick={onPickFolder}>
              Pick
            </button>
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
