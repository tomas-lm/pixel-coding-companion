import type { CSSProperties } from 'react'
import type { Project, RunningSession, TerminalConfig } from '../../../shared/workspace'
import type { LayoutResizeTarget } from '../app/layout'
import {
  KIND_LABELS,
  getProjectLiveLabel,
  getSessionCardDetail,
  getTerminalDetail,
  isLiveSession
} from '../app/sessionDisplay'
import { AddButton, IconOnlyButton, RowActionButton } from './ui/IconButtons'

type WorkspaceRailProps = {
  activeProject: Project | null
  activeProjectConfigs: TerminalConfig[]
  activeProjectSessions: RunningSession[]
  onClearTerminalHoverCard: () => void
  onCreateProject: () => void
  onCreateTerminal: () => void
  onEditProject: (project: Project) => void
  onEditTerminal: (config: TerminalConfig) => void
  onResizePointerDown: (
    event: React.PointerEvent<HTMLButtonElement>,
    target: LayoutResizeTarget
  ) => void
  onScheduleTerminalHoverCard: (config: TerminalConfig, target: HTMLElement) => void
  onSelectProject: (projectId: string) => void
  onSelectSession: (sessionId: string) => void
  onStartConfig: (config: TerminalConfig) => void
  onStartWorkspace: () => void
  onStopSession: (sessionId: string) => void
  projects: Project[]
  runningSessions: RunningSession[]
  selectedSessionId: string | null
}

export function WorkspaceRail({
  activeProject,
  activeProjectConfigs,
  activeProjectSessions,
  onClearTerminalHoverCard,
  onCreateProject,
  onCreateTerminal,
  onEditProject,
  onEditTerminal,
  onResizePointerDown,
  onScheduleTerminalHoverCard,
  onSelectProject,
  onSelectSession,
  onStartConfig,
  onStartWorkspace,
  onStopSession,
  projects,
  runningSessions,
  selectedSessionId
}: WorkspaceRailProps): React.JSX.Element {
  return (
    <aside className="workspace-rail">
      <div className="workspace-rail-scroll">
        <div className="brand-lockup">
          <div className="brand-title-row">
            <strong>Pixel Companion</strong>
            <span className="brand-version">v1.0.0</span>
          </div>
        </div>

        <section className="rail-section rail-section--projects" aria-label="Projects">
          <div className="rail-header">
            <span>Projects</span>
            <AddButton
              className="secondary-button"
              label="Add workspace"
              onClick={onCreateProject}
            />
          </div>

          <div className="project-list">
            {projects.length === 0 && (
              <div className="empty-list-state">No workspaces configured.</div>
            )}

            {projects.map((project) => (
              <div
                key={project.id}
                className={`project-row${project.id === activeProject?.id ? ' project-row--active' : ''}`}
                style={{ '--project-color': project.color } as CSSProperties}
              >
                <button
                  className="project-item"
                  type="button"
                  onClick={() => onSelectProject(project.id)}
                >
                  <span className="project-dot" aria-hidden="true" />
                  <span>{project.name}</span>
                  <small>{getProjectLiveLabel(project.id, runningSessions)}</small>
                </button>
                <RowActionButton
                  label={`Edit ${project.name}`}
                  onClick={() => onEditProject(project)}
                >
                  ...
                </RowActionButton>
              </div>
            ))}
          </div>
        </section>

        <button
          className="resize-handle resize-handle--row"
          type="button"
          aria-label="Resize projects"
          onPointerDown={(event) => onResizePointerDown(event, 'projectsHeight')}
        />

        <section className="rail-section rail-section--actions" aria-label="Workspace actions">
          {activeProject ? (
            <button className="primary-button" type="button" onClick={onStartWorkspace}>
              Start {activeProject.name}
            </button>
          ) : (
            <AddButton className="primary-button" label="Add workspace" onClick={onCreateProject} />
          )}
        </section>

        <section className="rail-section rail-section--config" aria-label="Configured terminals">
          <div className="rail-header">
            <span>Configured terminals</span>
            <AddButton
              className="secondary-button"
              label="Add terminal"
              disabled={!activeProject}
              onClick={onCreateTerminal}
            />
          </div>
          <div className="template-list">
            {!activeProject && (
              <div className="empty-list-state">Select or create a workspace first.</div>
            )}

            {activeProjectConfigs.map((config) => (
              <div
                key={config.id}
                className="template-row"
                onBlurCapture={onClearTerminalHoverCard}
                onFocusCapture={(event) => onScheduleTerminalHoverCard(config, event.currentTarget)}
                onMouseEnter={(event) => onScheduleTerminalHoverCard(config, event.currentTarget)}
                onMouseLeave={onClearTerminalHoverCard}
              >
                <button
                  className="template-item"
                  type="button"
                  onClick={() => onStartConfig(config)}
                >
                  <span className={`kind-badge kind-badge--${config.kind}`}>
                    {KIND_LABELS[config.kind]}
                  </span>
                  <strong>{config.name}</strong>
                  <small>{getTerminalDetail(config)}</small>
                </button>
                <RowActionButton
                  label={`Configure ${config.name}`}
                  onClick={() => onEditTerminal(config)}
                >
                  ...
                </RowActionButton>
              </div>
            ))}
          </div>
        </section>

        <button
          className="resize-handle resize-handle--row"
          type="button"
          aria-label="Resize configured terminals"
          onPointerDown={(event) => onResizePointerDown(event, 'terminalsHeight')}
        />

        <section className="rail-section rail-section--running" aria-label="Running sessions">
          <div className="rail-header">
            <span>Running</span>
            <small>{activeProjectSessions.length}</small>
          </div>

          <div className="session-list">
            {activeProjectSessions.map((session) => (
              <div
                key={session.id}
                className={`session-row session-row--${session.status}${
                  session.id === selectedSessionId ? ' session-row--active' : ''
                }`}
              >
                <button
                  className="session-item"
                  type="button"
                  onClick={() => onSelectSession(session.id)}
                >
                  <span className={`kind-badge kind-badge--${session.kind}`}>
                    {KIND_LABELS[session.kind]}
                  </span>
                  <strong>{session.name}</strong>
                  <small>{getSessionCardDetail(session)}</small>
                </button>
                {isLiveSession(session) ? (
                  <IconOnlyButton
                    className="session-stop session-stop--live"
                    label={`Stop ${session.name}`}
                    onClick={() => onStopSession(session.id)}
                  >
                    &#9632;
                  </IconOnlyButton>
                ) : (
                  <button
                    className="session-stop"
                    type="button"
                    aria-label={`Clear ${session.name}`}
                    title={`Clear ${session.name}`}
                    onClick={() => onStopSession(session.id)}
                  >
                    Clear
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </aside>
  )
}
