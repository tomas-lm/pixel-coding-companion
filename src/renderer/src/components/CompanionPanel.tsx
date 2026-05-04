import { useEffect, useRef, type CSSProperties, type PointerEvent } from 'react'
import type { CompanionBridgeMessage, CompanionCliState } from '../../../shared/companion'
import type { CompanionSpriteStage } from '../companions/companionTypes'
import type { CompanionProgress } from '../lib/companionProgress'
import { CompanionProgressBar } from './CompanionProgressBar'

type CompanionPanelProps = {
  companionName: string
  companionStage: CompanionSpriteStage
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
  companionStage,
  companionState,
  getMessageColor,
  messages,
  onResizePointerDown,
  progress
}: CompanionPanelProps): React.JSX.Element {
  const terminalScreenRef = useRef<HTMLDivElement | null>(null)
  const latestMessageId = messages.at(-1)?.id
  const companionSpriteStyle = {
    backgroundImage: `url(${companionStage.spriteUrl})`,
    backgroundSize: `${companionStage.frameColumns * 100}% ${companionStage.frameRows * 100}%`,
    height: `${companionStage.height}px`,
    transform:
      companionStage.offsetX === undefined && companionStage.offsetY === undefined
        ? undefined
        : `translate(${companionStage.offsetX ?? 0}px, ${companionStage.offsetY ?? 0}px)`,
    width: `${companionStage.width}px`
  } as CSSProperties

  useEffect(() => {
    const terminalScreen = terminalScreenRef.current
    if (!terminalScreen) return

    terminalScreen.scrollTop = terminalScreen.scrollHeight
  }, [latestMessageId])

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
            <div className="companion-terminal-screen" ref={terminalScreenRef}>
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
                  {message.details && (
                    <pre tabIndex={0} aria-label="Full message details">
                      {message.details}
                    </pre>
                  )}
                </article>
              ))}
            </div>
          </div>

          <div
            className={`pixel-companion pixel-companion--stage-${companionStage.id} pixel-companion--${companionState}`}
            style={companionSpriteStyle}
            aria-hidden="true"
          />
          <div className="shadow" />
          <CompanionProgressBar progress={progress} />
        </div>
      </aside>
    </>
  )
}
