import type { CSSProperties, PointerEvent } from 'react'
import type { CompanionBridgeMessage, CompanionCliState } from '../../../shared/companion'
import type { CompanionProgress } from '../lib/companionProgress'
import { CompanionProgressBar } from './CompanionProgressBar'

type CompanionPanelProps = {
  companionName: string
  companionState: CompanionCliState
  getMessageColor: (message: CompanionBridgeMessage) => string
  messages: CompanionBridgeMessage[]
  onResizePointerDown: (event: PointerEvent<HTMLButtonElement>) => void
  progress: CompanionProgress
}

function formatCompanionTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value))
}

function getCompanionStateLabel(state: CompanionCliState): string {
  if (state === 'waiting_input') return 'waiting input'
  return state
}

export function CompanionPanel({
  companionName,
  companionState,
  getMessageColor,
  messages,
  onResizePointerDown,
  progress
}: CompanionPanelProps): React.JSX.Element {
  return (
    <>
      <button
        className="resize-handle resize-handle--column"
        type="button"
        aria-label="Resize companion panel"
        onPointerDown={onResizePointerDown}
      />

      <aside className="companion-panel" aria-label="Companion preview">
        <div className="companion-stage">
          <div className="companion-terminal">
            <header className="companion-terminal-header">
              <div className="terminal-controls" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <strong>{companionName}</strong>
              <small>{getCompanionStateLabel(companionState)}</small>
            </header>
            <div className="companion-terminal-screen">
              {messages.map((message) => (
                <article
                  key={message.id}
                  className={`companion-line companion-line--${message.cliState}`}
                  style={{ '--message-color': getMessageColor(message) } as CSSProperties}
                >
                  <div className="companion-line-meta">
                    <span>{formatCompanionTime(message.createdAt)}</span>
                    <strong>{companionName}</strong>
                    {(message.agentName || message.projectName) && (
                      <small>
                        {[message.agentName, message.projectName].filter(Boolean).join(' / ')}
                      </small>
                    )}
                  </div>
                  <p>{message.summary}</p>
                  {message.details && <pre>{message.details}</pre>}
                </article>
              ))}
            </div>
          </div>

          <div className={`pixel-companion pixel-companion--${companionState}`} aria-hidden="true">
            <span className="pixel-eye pixel-eye--left" />
            <span className="pixel-eye pixel-eye--right" />
            <span className="pixel-mouth" />
          </div>
          <div className="shadow" />
          <CompanionProgressBar progress={progress} />
        </div>
      </aside>
    </>
  )
}
