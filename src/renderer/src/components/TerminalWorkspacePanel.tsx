import type {
  Project,
  RunningSession,
  TerminalConfig,
  TerminalThemeId
} from '../../../shared/workspace'
import { AddButton } from './ui/IconButtons'
import { TerminalPane } from './TerminalPane'

type TerminalWorkspacePanelProps = {
  activeProject: Project | null
  activeProjectConfigs: TerminalConfig[]
  activeSession: RunningSession | null
  onCreateProject: () => void
  onCreateTerminal: () => void
  onOpenPromptPicker: () => void
  onSessionActivity: (sessionId: string, output: string) => void
  onSessionStartError: (sessionId: string, errorMessage: string) => void
  onSessionStarted: (sessionId: string, metadata: string) => void
  onStartWorkspace: () => void
  runningSessions: RunningSession[]
  selectedSessionId: string | null
  sessionSummary: string
  terminalThemeId: TerminalThemeId
  terminalTitle: string
}

export function TerminalWorkspacePanel({
  activeProject,
  activeProjectConfigs,
  activeSession,
  onCreateProject,
  onCreateTerminal,
  onOpenPromptPicker,
  onSessionActivity,
  onSessionStartError,
  onSessionStarted,
  onStartWorkspace,
  runningSessions,
  selectedSessionId,
  sessionSummary,
  terminalThemeId,
  terminalTitle
}: TerminalWorkspacePanelProps): React.JSX.Element {
  return (
    <section className="session-panel" aria-label="Session preview">
      <header className="session-header">
        <div>
          <span className="eyebrow">{activeProject?.name ?? 'Pixel Companion'}</span>
          <h1>{terminalTitle}</h1>
          <p>{sessionSummary}</p>
        </div>
        <div className="session-header-actions">
          <button
            className="secondary-button session-prompt-button"
            type="button"
            onClick={onOpenPromptPicker}
          >
            Use prompt
          </button>
        </div>
      </header>

      <div className="session-body">
        <div className="terminal-stack">
          {runningSessions.map((session) => (
            <div
              key={session.id}
              className={`terminal-pane-instance${
                session.id === selectedSessionId ? ' terminal-pane-instance--active' : ''
              }`}
            >
              <TerminalPane
                session={session}
                isActive={session.id === selectedSessionId}
                terminalThemeId={terminalThemeId}
                onSessionActivity={onSessionActivity}
                onSessionStartError={onSessionStartError}
                onSessionStarted={onSessionStarted}
              />
            </div>
          ))}
        </div>
        {!activeSession && (
          <div className="empty-terminal">
            <strong>{activeProject?.name ?? 'No workspaces yet'}</strong>
            {!activeProject ? (
              <AddButton
                className="primary-button"
                label="Add workspace"
                onClick={onCreateProject}
              />
            ) : activeProjectConfigs.length === 0 ? (
              <AddButton
                className="primary-button"
                label="Add terminal"
                onClick={onCreateTerminal}
              />
            ) : (
              <button className="primary-button" type="button" onClick={onStartWorkspace}>
                Start workspace
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
