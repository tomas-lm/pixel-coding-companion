import type { TerminalContextHudSnapshot, TerminalContextHudStatus } from '../../../shared/terminal'

type TerminalContextHudProps = {
  isCodexCandidate: boolean
  snapshot: TerminalContextHudSnapshot | null
}

const STATUS_LABELS: Record<TerminalContextHudStatus, string> = {
  compact_soon: 'Compact soon',
  danger: 'Danger zone',
  filling: 'Filling',
  flow: 'Flow',
  unknown: 'Waiting'
}

export function TerminalContextHud({
  isCodexCandidate,
  snapshot
}: TerminalContextHudProps): React.JSX.Element | null {
  if (!isCodexCandidate && !snapshot) return null

  const status = snapshot?.status ?? 'unknown'
  const contextUsedPercent = snapshot?.contextUsedPercent ?? null
  const contextLabel =
    typeof contextUsedPercent === 'number'
      ? `Context ${Math.round(contextUsedPercent)}%`
      : 'Context --'
  const modelLabel = snapshot?.model
  const reasoningLabel = snapshot?.reasoningEffort

  return (
    <div
      className={`terminal-context-hud terminal-context-hud--${status}`}
      aria-label="Codex context"
    >
      <div className="terminal-context-hud__identity">
        <strong>Codex</strong>
        {modelLabel && <span>{modelLabel}</span>}
        {reasoningLabel && <span>{reasoningLabel}</span>}
      </div>
      <div
        className="terminal-context-hud__meter"
        role={contextUsedPercent === null ? undefined : 'progressbar'}
        aria-label={contextUsedPercent === null ? undefined : contextLabel}
        aria-valuemin={contextUsedPercent === null ? undefined : 0}
        aria-valuemax={contextUsedPercent === null ? undefined : 100}
        aria-valuenow={contextUsedPercent === null ? undefined : Math.round(contextUsedPercent)}
      >
        <span style={{ width: `${contextUsedPercent ?? 0}%` }} />
      </div>
      <div className="terminal-context-hud__summary">
        <span>{contextLabel}</span>
        <strong>{STATUS_LABELS[status]}</strong>
      </div>
    </div>
  )
}
