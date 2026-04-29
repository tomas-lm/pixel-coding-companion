import { useCallback, useState, type CSSProperties } from 'react'
import {
  type Project,
  type RunningSession,
  type RunningSessionStatus,
  type SessionKind,
  type SessionTemplate
} from '../../shared/workspace'
import { TerminalPane } from './components/TerminalPane'

const PROJECT_COLORS = ['#4ea1ff', '#ef5b5b', '#f7d56f', '#7fe7dc', '#c084fc', '#34d399']

const KIND_LABELS: Record<SessionKind, string> = {
  ai: 'AI',
  shell: 'Shell',
  dev_server: 'Dev Server',
  logs: 'Logs',
  test: 'Test',
  custom: 'Custom'
}

const INITIAL_PROJECTS: Project[] = [
  {
    id: 'local-workspace',
    name: 'Local Workspace',
    color: PROJECT_COLORS[0],
    path: ''
  }
]

function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}

function createDefaultTemplates(projectId: string, cwd: string): SessionTemplate[] {
  return [
    {
      id: `${projectId}-shell`,
      projectId,
      name: 'Shell',
      kind: 'shell',
      command: '',
      cwd
    },
    {
      id: `${projectId}-ai-terminal`,
      projectId,
      name: 'AI Terminal',
      kind: 'ai',
      command: '',
      cwd
    },
    {
      id: `${projectId}-dev-server`,
      projectId,
      name: 'Dev Server',
      kind: 'dev_server',
      command: '',
      cwd
    }
  ]
}

const INITIAL_TEMPLATES = createDefaultTemplates(INITIAL_PROJECTS[0].id, INITIAL_PROJECTS[0].path)

function createRunningSession(template: SessionTemplate): RunningSession {
  return {
    id: createId('session'),
    projectId: template.projectId,
    templateId: template.id,
    name: template.name,
    kind: template.kind,
    command: template.command,
    cwd: template.cwd,
    status: 'starting',
    metadata: template.cwd || 'home folder'
  }
}

function getProjectPathLabel(path: string): string {
  return path || 'Home folder'
}

function getProjectLiveLabel(projectId: string, runningSessions: RunningSession[]): string {
  const liveCount = runningSessions.filter(
    (session) => session.projectId === projectId && session.status !== 'exited'
  ).length

  if (liveCount === 1) return '1 live'
  if (liveCount > 1) return `${liveCount} live`
  return 'ready'
}

function getCompanionMessage(session: RunningSession | null): string {
  if (!session) return 'Workspace pronto.'
  if (session.status === 'starting') return `${session.name} esta iniciando.`
  if (session.status === 'running') return `${session.name} esta ativo.`
  if (session.status === 'exited') return `${session.name} encerrou.`
  return `${session.name} precisa de atencao.`
}

function App(): React.JSX.Element {
  const [projects, setProjects] = useState<Project[]>(INITIAL_PROJECTS)
  const [templates, setTemplates] = useState<SessionTemplate[]>(INITIAL_TEMPLATES)
  const [runningSessions, setRunningSessions] = useState<RunningSession[]>([])
  const [activeProjectId, setActiveProjectId] = useState(INITIAL_PROJECTS[0].id)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)

  const activeProject = projects.find((project) => project.id === activeProjectId) ?? projects[0]
  const activeProjectTemplates = templates.filter(
    (template) => template.projectId === activeProject.id
  )
  const activeProjectSessions = runningSessions.filter(
    (session) => session.projectId === activeProject.id
  )
  const activeSession =
    runningSessions.find(
      (session) => session.id === activeSessionId && session.projectId === activeProject.id
    ) ??
    activeProjectSessions[0] ??
    null
  const activeStyle = { '--active-project-color': activeProject.color } as CSSProperties

  const updateSessionStatus = useCallback(
    (sessionId: string, status: RunningSessionStatus): void => {
      setRunningSessions((currentSessions) =>
        currentSessions.map((session) =>
          session.id === sessionId ? { ...session, status } : session
        )
      )
    },
    []
  )

  const updateSessionMetadata = useCallback((sessionId: string, metadata: string): void => {
    setRunningSessions((currentSessions) =>
      currentSessions.map((session) =>
        session.id === sessionId ? { ...session, metadata } : session
      )
    )
  }, [])

  const selectProject = (projectId: string): void => {
    setActiveProjectId(projectId)
    setActiveSessionId(
      runningSessions.find((session) => session.projectId === projectId)?.id ?? null
    )
  }

  const startTemplate = (template: SessionTemplate): void => {
    const existingSession = runningSessions.find(
      (session) => session.templateId === template.id && session.status !== 'exited'
    )

    if (existingSession) {
      setActiveProjectId(existingSession.projectId)
      setActiveSessionId(existingSession.id)
      return
    }

    const session = createRunningSession(template)
    setRunningSessions((currentSessions) => [...currentSessions, session])
    setActiveProjectId(template.projectId)
    setActiveSessionId(session.id)
  }

  const startWorkspace = (): void => {
    const liveTemplateIds = new Set(
      runningSessions
        .filter((session) => session.projectId === activeProject.id && session.status !== 'exited')
        .map((session) => session.templateId)
    )
    const sessionsToStart = activeProjectTemplates
      .filter((template) => !liveTemplateIds.has(template.id))
      .map(createRunningSession)
    const firstExistingSession = runningSessions.find(
      (session) => session.projectId === activeProject.id && session.status !== 'exited'
    )

    if (sessionsToStart.length > 0) {
      setRunningSessions((currentSessions) => [...currentSessions, ...sessionsToStart])
      setActiveSessionId(sessionsToStart[0].id)
      return
    }

    if (firstExistingSession) {
      setActiveSessionId(firstExistingSession.id)
    }
  }

  const stopSession = (sessionId: string): void => {
    const nextActiveSession = runningSessions.find(
      (session) => session.id !== sessionId && session.projectId === activeProject.id
    )

    setRunningSessions((currentSessions) =>
      currentSessions.filter((session) => session.id !== sessionId)
    )

    if (activeSession?.id === sessionId) {
      setActiveSessionId(nextActiveSession?.id ?? null)
    }
  }

  const addProjectFromFolder = async (): Promise<void> => {
    const folder = await window.api.workspace.pickFolder()
    if (!folder) return

    const project: Project = {
      id: createId('project'),
      name: folder.name,
      color: PROJECT_COLORS[projects.length % PROJECT_COLORS.length],
      path: folder.path
    }

    setProjects((currentProjects) => [...currentProjects, project])
    setTemplates((currentTemplates) => [
      ...currentTemplates,
      ...createDefaultTemplates(project.id, project.path)
    ])
    setActiveProjectId(project.id)
    setActiveSessionId(null)
  }

  const companionMessage = getCompanionMessage(activeSession)
  const terminalTitle = activeSession?.name ?? 'Workspace'
  const terminalStatus = activeSession?.status ?? 'ready'
  const activeSessionKind = activeSession?.kind ?? 'shell'
  const selectedSessionId = activeSession?.id ?? null

  return (
    <main className="app-shell" style={activeStyle}>
      <aside className="workspace-rail">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true" />
          <div>
            <strong>Pixel Coding Companion</strong>
            <span>Local agent desk</span>
          </div>
        </div>

        <section className="rail-section" aria-label="Projects">
          <div className="rail-header">
            <span>Projects</span>
            <button className="secondary-button" type="button" onClick={addProjectFromFolder}>
              Add folder
            </button>
          </div>

          <div className="project-list">
            {projects.map((project) => (
              <button
                key={project.id}
                className={`project-item${project.id === activeProject.id ? ' project-item--active' : ''}`}
                style={{ '--project-color': project.color } as CSSProperties}
                type="button"
                onClick={() => selectProject(project.id)}
              >
                <span className="project-dot" aria-hidden="true" />
                <span>{project.name}</span>
                <small>{getProjectLiveLabel(project.id, runningSessions)}</small>
              </button>
            ))}
          </div>
        </section>

        <section className="rail-section" aria-label="Session templates">
          <div className="rail-header">
            <span>Templates</span>
            <button className="primary-button" type="button" onClick={startWorkspace}>
              Start workspace
            </button>
          </div>

          <div className="template-list">
            {activeProjectTemplates.map((template) => (
              <button
                key={template.id}
                className="template-item"
                type="button"
                onClick={() => startTemplate(template)}
              >
                <span className={`kind-badge kind-badge--${template.kind}`}>
                  {KIND_LABELS[template.kind]}
                </span>
                <strong>{template.name}</strong>
                <small>{template.command || 'interactive shell'}</small>
              </button>
            ))}
          </div>
        </section>

        <section className="rail-section" aria-label="Running sessions">
          <div className="rail-header">
            <span>Running</span>
            <small>{activeProjectSessions.length}</small>
          </div>

          <div className="session-list">
            {activeProjectSessions.map((session) => (
              <button
                key={session.id}
                className={`session-item${session.id === selectedSessionId ? ' session-item--active' : ''}`}
                type="button"
                onClick={() => setActiveSessionId(session.id)}
              >
                <span className={`kind-badge kind-badge--${session.kind}`}>
                  {KIND_LABELS[session.kind]}
                </span>
                <strong>{session.name}</strong>
                <small>{session.status}</small>
                <span
                  className="session-stop"
                  role="button"
                  tabIndex={0}
                  onClick={(event) => {
                    event.stopPropagation()
                    stopSession(session.id)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      event.stopPropagation()
                      stopSession(session.id)
                    }
                  }}
                >
                  Stop
                </span>
              </button>
            ))}
          </div>
        </section>
      </aside>

      <section className="session-panel" aria-label="Session preview">
        <header className="session-header">
          <div>
            <span className="eyebrow">{activeProject.name}</span>
            <h1>{terminalTitle}</h1>
            <p>{getProjectPathLabel(activeProject.path)}</p>
          </div>
          <div className="session-header-actions">
            <span className={`kind-badge kind-badge--${activeSessionKind}`}>
              {KIND_LABELS[activeSessionKind]}
            </span>
            <span className="status-pill">{terminalStatus}</span>
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
                  onMetadataChange={updateSessionMetadata}
                  onStatusChange={updateSessionStatus}
                />
              </div>
            ))}
          </div>
          {!activeSession && (
            <div className="empty-terminal">
              <strong>{activeProject.name}</strong>
              <button className="primary-button" type="button" onClick={startWorkspace}>
                Start workspace
              </button>
            </div>
          )}
        </div>
      </section>

      <aside className="companion-panel" aria-label="Companion preview">
        <div className="companion-stage">
          <div className="speech-bubble">
            <span>{activeProject.name}</span>
            <p>{companionMessage}</p>
          </div>
          <div className="pixel-companion" aria-hidden="true">
            <span className="pixel-eye pixel-eye--left" />
            <span className="pixel-eye pixel-eye--right" />
            <span className="pixel-mouth" />
          </div>
          <div className="shadow" />
        </div>
      </aside>
    </main>
  )
}

export default App
