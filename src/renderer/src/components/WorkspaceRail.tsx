import { useCallback, useState, type CSSProperties } from 'react'
import type { Project, RunningSession, TerminalConfig } from '../../../shared/workspace'
import type { LayoutResizeTarget } from '../app/layout'
import {
  KIND_LABELS,
  getProjectLiveLabel,
  getSessionCardDetail,
  getTerminalDetail,
  isLiveSession
} from '../app/sessionDisplay'
import { RailSortableList } from './RailSortableList'
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
  onReorderProjects: (draggedProjectId: string, targetIndex: number) => void
  onReorderRunning: (draggedSessionId: string, targetIndex: number) => void
  onReorderTerminals: (draggedConfigId: string, targetIndex: number) => void
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
  onReorderProjects,
  onReorderRunning,
  onReorderTerminals,
  onSelectProject,
  onSelectSession,
  onStartConfig,
  onStartWorkspace,
  onStopSession,
  projects,
  runningSessions,
  selectedSessionId
}: WorkspaceRailProps): React.JSX.Element {
  const [isDragging, setIsDragging] = useState(false)

  const updateDraggingState = useCallback(
    (isListDragging: boolean): void => {
      setIsDragging(isListDragging)
      if (isListDragging) {
        onClearTerminalHoverCard()
      }
    },
    [onClearTerminalHoverCard]
  )

  return (
    <aside className={`workspace-rail${isDragging ? ' workspace-rail--dragging' : ''}`}>
      <div className="workspace-rail-scroll">
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
            {projects.length > 0 && (
              <RailSortableList
                className="drag-reorder-list"
                items={projects}
                onDragStateChange={updateDraggingState}
                onReorder={onReorderProjects}
                renderItem={(project, _index, sortableArgs) => (
                  <div
                    ref={sortableArgs.setNodeRef}
                    className={`project-row${project.id === activeProject?.id ? ' project-row--active' : ''}`}
                    style={
                      {
                        '--project-color': project.color,
                        ...sortableArgs.style
                      } as CSSProperties
                    }
                    {...sortableArgs.attributes}
                    {...sortableArgs.listeners}
                  >
                    <button
                      className="project-item"
                      type="button"
                      onClick={() => onSelectProject(project.id)}
                    >
                      <span className="project-dot" aria-hidden="true" />
                      <span className="project-name">{project.name}</span>
                      <small className="project-live-count">
                        {getProjectLiveLabel(project.id, runningSessions)}
                      </small>
                    </button>
                    <RowActionButton
                      label={`Edit ${project.name}`}
                      onClick={() => onEditProject(project)}
                    >
                      ...
                    </RowActionButton>
                  </div>
                )}
              />
            )}
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
            <span>Terminals</span>
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
            {activeProjectConfigs.length > 0 && (
              <RailSortableList
                className="drag-reorder-list"
                items={activeProjectConfigs}
                onDragStateChange={updateDraggingState}
                onReorder={onReorderTerminals}
                renderItem={(config, _index, sortableArgs) => (
                  <div
                    ref={sortableArgs.setNodeRef}
                    className="template-row"
                    style={sortableArgs.style}
                    onBlurCapture={onClearTerminalHoverCard}
                    onFocusCapture={(event) => {
                      if (isDragging) return
                      onScheduleTerminalHoverCard(config, event.currentTarget)
                    }}
                    onMouseEnter={(event) => {
                      if (isDragging) return
                      onScheduleTerminalHoverCard(config, event.currentTarget)
                    }}
                    onMouseLeave={onClearTerminalHoverCard}
                    {...sortableArgs.attributes}
                    {...sortableArgs.listeners}
                  >
                    <button
                      className="template-item"
                      type="button"
                      onClick={() => onStartConfig(config)}
                    >
                      <span className={`kind-badge kind-badge--${config.kind}`}>
                        {KIND_LABELS[config.kind]}
                      </span>
                      <strong className="template-name">{config.name}</strong>
                      <small className="template-detail">{getTerminalDetail(config)}</small>
                    </button>
                    <RowActionButton
                      label={`Configure ${config.name}`}
                      onClick={() => onEditTerminal(config)}
                    >
                      ...
                    </RowActionButton>
                  </div>
                )}
              />
            )}
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
            {activeProjectSessions.length > 0 && (
              <RailSortableList
                className="drag-reorder-list"
                items={activeProjectSessions}
                onDragStateChange={updateDraggingState}
                onReorder={onReorderRunning}
                renderItem={(session, _index, sortableArgs) => (
                  <div
                    ref={sortableArgs.setNodeRef}
                    className={`session-row session-row--${session.status}${
                      session.id === selectedSessionId ? ' session-row--active' : ''
                    }`}
                    style={sortableArgs.style}
                    {...sortableArgs.attributes}
                    {...sortableArgs.listeners}
                  >
                    <button
                      className="session-item"
                      type="button"
                      onClick={() => onSelectSession(session.id)}
                    >
                      <span
                        className={`session-status-dot session-status-dot--${session.status}`}
                        aria-hidden="true"
                      />
                      <span className={`kind-badge kind-badge--${session.kind}`}>
                        {KIND_LABELS[session.kind]}
                      </span>
                      <strong className="session-name">{session.name}</strong>
                      <small className="session-detail">{getSessionCardDetail(session)}</small>
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
                )}
              />
            )}
          </div>
        </section>
      </div>
    </aside>
  )
}
