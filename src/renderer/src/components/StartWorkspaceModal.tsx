import {
  PIXEL_LAUNCHER_AGENT_OPTIONS,
  type PixelLauncherAgentId,
  type Project,
  type TerminalConfig
} from '../../../shared/workspace'
import { KIND_LABELS, getTerminalDetail } from '../app/sessionDisplay'

type StartWorkspaceModalProps = {
  configs: TerminalConfig[]
  liveConfigIds: Set<string>
  pixelAgent: PixelLauncherAgentId
  onChangePixelAgent: (pixelAgent: PixelLauncherAgentId) => void
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

function getCompactAgentLabel(option: (typeof PIXEL_LAUNCHER_AGENT_OPTIONS)[number]): string {
  if (option.id === 'claude') return 'Claude'
  return option.label
}

export function StartWorkspaceModal({
  configs,
  liveConfigIds,
  onClose,
  onSelectCategory,
  onStartSelected,
  onToggleConfig,
  onToggleStartWithPixel,
  onChangePixelAgent,
  pixelAgent,
  project,
  selectedConfigIds,
  selectedCount,
  selectedPixelConfigCount,
  selectedPixelLabel,
  startWithPixel
}: StartWorkspaceModalProps): React.JSX.Element {
  const selectedAgentLabel =
    PIXEL_LAUNCHER_AGENT_OPTIONS.find((option) => option.id === pixelAgent)?.label ??
    PIXEL_LAUNCHER_AGENT_OPTIONS[0].label
  const agentWarning =
    pixelAgent === 'auto'
      ? 'Keep this on so Pixel can auto-detect Claude Code or Codex launch commands.'
      : `Keep this on for ${selectedAgentLabel} terminals if you want companion context and XP fallback to work.`

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
          <div className="start-agent-row">
            <label className="start-agent-toggle">
              <input type="checkbox" checked={startWithPixel} onChange={onToggleStartWithPixel} />
              <span>
                <strong>Start with Pixel</strong>
                <small>
                  Launches supported AI terminals through Pixel instead of injecting a prompt.
                </small>
              </span>
            </label>
            <div className="start-agent-picker">
              <span>Agent</span>
              <div
                className="start-agent-segmented"
                role="radiogroup"
                aria-label="Pixel launcher agent"
              >
                {PIXEL_LAUNCHER_AGENT_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    className="start-agent-segmented__option"
                    type="button"
                    role="radio"
                    aria-checked={option.id === pixelAgent}
                    disabled={!startWithPixel}
                    onClick={() => onChangePixelAgent(option.id as PixelLauncherAgentId)}
                  >
                    {getCompactAgentLabel(option)}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <p className="start-agent-warning">
            {agentWarning} It applies to {selectedPixelConfigCount} selected AI {selectedPixelLabel}{' '}
            with matching launch commands.
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
