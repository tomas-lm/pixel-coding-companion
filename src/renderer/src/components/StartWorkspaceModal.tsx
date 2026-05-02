import type { Project, TerminalConfig } from '../../../shared/workspace'
import { KIND_LABELS, getTerminalDetail } from '../app/sessionDisplay'

type StartWorkspaceModalProps = {
  configs: TerminalConfig[]
  liveConfigIds: Set<string>
  onClose: () => void
  onSelectCategory: (category: 'all' | 'ai' | 'run') => void
  onStartSelected: () => void
  onToggleConfig: (configId: string) => void
  onToggleStartWithPixel: () => void
  project: Project
  selectedConfigIds: string[]
  selectedCount: number
  selectedPixelConfigCount: number
  selectedPixelLabel: string
  startWithPixel: boolean
}

export function StartWorkspaceModal({
  configs,
  liveConfigIds,
  onClose,
  onSelectCategory,
  onStartSelected,
  onToggleConfig,
  onToggleStartWithPixel,
  project,
  selectedConfigIds,
  selectedCount,
  selectedPixelConfigCount,
  selectedPixelLabel,
  startWithPixel
}: StartWorkspaceModalProps): React.JSX.Element {
  return (
    <div className="modal-backdrop">
      <section className="modal modal--wide" aria-label={`Start ${project.name}`}>
        <header className="modal-header">
          <div>
            <h2>Start {project.name}</h2>
            <p className="modal-subtitle">Choose which terminals should launch now.</p>
          </div>
          <button className="icon-button" type="button" onClick={onClose}>
            Close
          </button>
        </header>

        <div className="start-filter-row" role="group" aria-label="Start selection filters">
          <button
            className="secondary-button"
            type="button"
            onClick={() => onSelectCategory('all')}
          >
            All
          </button>
          <button className="secondary-button" type="button" onClick={() => onSelectCategory('ai')}>
            AI only
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={() => onSelectCategory('run')}
          >
            Run only
          </button>
        </div>

        <div className="start-agent-instruction-panel">
          <label className="start-agent-toggle">
            <input type="checkbox" checked={startWithPixel} onChange={onToggleStartWithPixel} />
            <span>
              <strong>Start with Pixel</strong>
              <small>
                Launches supported AI terminals through Pixel instead of injecting a prompt.
              </small>
            </span>
          </label>
          <p className="start-agent-warning">
            Keep this on for Codex terminals if you want companion hooks and XP fallback to work. It
            applies to {selectedPixelConfigCount} selected AI {selectedPixelLabel} with launch
            commands.
          </p>
        </div>

        <div className="start-config-list">
          {configs.length === 0 && (
            <div className="empty-start-state">No configured terminals yet.</div>
          )}

          {configs.map((config) => {
            const isLive = liveConfigIds.has(config.id)
            const isSelected = selectedConfigIds.includes(config.id) && !isLive

            return (
              <label
                key={config.id}
                className={`start-config-item${isLive ? ' start-config-item--disabled' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  disabled={isLive}
                  onChange={() => onToggleConfig(config.id)}
                />
                <span className={`kind-badge kind-badge--${config.kind}`}>
                  {KIND_LABELS[config.kind]}
                </span>
                <strong>{config.name}</strong>
                <small>{isLive ? 'Already running' : getTerminalDetail(config)}</small>
              </label>
            )
          })}
        </div>

        <footer className="modal-actions">
          <span className="selection-count">{selectedCount} selected</span>
          <div className="modal-action-buttons">
            <button className="secondary-button" type="button" onClick={onClose}>
              Cancel
            </button>
            <button
              className="primary-button"
              type="button"
              disabled={selectedCount === 0}
              onClick={onStartSelected}
            >
              Start selected
            </button>
          </div>
        </footer>
      </section>
    </div>
  )
}
