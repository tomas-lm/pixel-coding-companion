import { useState } from 'react'
import type {
  Project,
  RunningSession,
  TerminalConfig,
  TerminalThemeId,
  WorkspaceCodeEditorSettings
} from '../../../shared/workspace'
import { AddButton } from './ui/IconButtons'
import { SessionChangesPanel } from './SessionChangesPanel'
import { TerminalPane } from './TerminalPane'

type TerminalWorkspacePanelProps = {
  activeProject: Project | null
  activeProjectConfigs: TerminalConfig[]
  activeSession: RunningSession | null
  codeEditorSettings: WorkspaceCodeEditorSettings
  onCreateProject: () => void
  onCreateTerminal: () => void
  onOpenMarkdownArtifact: (filePath: string) => void
  onOpenPromptPicker: () => void
  onSessionActivity: (sessionId: string, output: string) => void
  onSessionStartError: (sessionId: string, errorMessage: string) => void
  onSessionStarted: (sessionId: string, metadata: string) => void
  onStartWorkspace: () => void
  runningSessions: RunningSession[]
  selectedSessionId: string | null
  terminalThemeId: TerminalThemeId
  terminalTitle: string
}

export function TerminalWorkspacePanel({
  activeProject,
  activeProjectConfigs,
  activeSession,
  codeEditorSettings,
  onCreateProject,
  onCreateTerminal,
  onOpenMarkdownArtifact,
  onOpenPromptPicker,
  onSessionActivity,
  onSessionStartError,
  onSessionStarted,
  onStartWorkspace,
  runningSessions,
  selectedSessionId,
  terminalThemeId,
  terminalTitle
}: TerminalWorkspacePanelProps): React.JSX.Element {
  const [changesSessionId, setChangesSessionId] = useState<string | null>(null)
  const isChangesOpen = Boolean(activeSession && changesSessionId === activeSession.id)

  return (
    <section className="session-panel" aria-label="Session preview">
      <header className="session-header">
        <div>
          <span className="eyebrow">{activeProject?.name ?? 'Pixel Companion'}</span>
          <h1>{terminalTitle}</h1>
        </div>
        <div className="session-header-actions">
          <button
            className="secondary-button session-prompt-button"
            type="button"
            disabled={!activeSession}
            onClick={() => setChangesSessionId(isChangesOpen ? null : (activeSession?.id ?? null))}
          >
            Changes
          </button>
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
                codeEditorSettings={codeEditorSettings}
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
        {activeSession && isChangesOpen ? (
          <SessionChangesPanel
            codeEditorSettings={codeEditorSettings}
            session={activeSession}
            onClose={() => setChangesSessionId(null)}
            onOpenMarkdownFile={onOpenMarkdownArtifact}
          />
        ) : null}
      </div>
    </section>
  )
}
