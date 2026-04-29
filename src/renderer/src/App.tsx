import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import type {
  CompanionBridgeMessage,
  CompanionBridgeState,
  CompanionCliState
} from '../../shared/companion'
import {
  type Project,
  type RunningSession,
  type RunningSessionStatus,
  type SessionKind,
  type TerminalConfig,
  type WorkspaceLayout
} from '../../shared/workspace'
import { TerminalPane } from './components/TerminalPane'

const PROJECT_COLORS = ['#4ea1ff', '#ef5b5b', '#f7d56f', '#7fe7dc', '#c084fc', '#34d399']
const DEFAULT_LAYOUT: WorkspaceLayout = {
  railWidth: 300,
  companionWidth: 320,
  projectsHeight: 178,
  terminalsHeight: 260
}
const LAYOUT_LIMITS: Record<keyof WorkspaceLayout, { min: number; max: number }> = {
  railWidth: { min: 240, max: 520 },
  companionWidth: { min: 220, max: 520 },
  projectsHeight: { min: 110, max: 360 },
  terminalsHeight: { min: 130, max: 420 }
}

const KIND_LABELS: Record<SessionKind, string> = {
  ai: 'AI',
  shell: 'Shell',
  dev_server: 'Dev Server',
  logs: 'Logs',
  test: 'Test',
  custom: 'Custom'
}

const SESSION_STATUS_LABELS: Record<RunningSessionStatus, string> = {
  starting: 'Starting',
  running: 'Running',
  done: 'Done',
  error: 'Error'
}

const ANSI_SEQUENCE_PATTERN = new RegExp(`${String.fromCharCode(27)}\\[[0-9;?]*[ -/]*[@-~]`, 'g')
const ACTIVE_SESSION_STATUSES = new Set<RunningSessionStatus>(['starting', 'running'])
const DEFAULT_COMPANION_BRIDGE_STATE: CompanionBridgeState = {
  currentState: 'idle',
  messages: []
}

type ProjectForm = {
  id?: string
  name: string
  description: string
  color: string
}

type TerminalForm = {
  id?: string
  name: string
  kind: SessionKind
  cwd: string
  commandsText: string
}

type StartWorkspaceSelection = {
  projectId: string
  selectedConfigIds: string[]
}

type LayoutResizeTarget = keyof WorkspaceLayout
type RunningSessionPatch = Partial<
  Pick<
    RunningSession,
    | 'durationMs'
    | 'endedAt'
    | 'exitCode'
    | 'exitSignal'
    | 'lastActivityAt'
    | 'lastOutputPreview'
    | 'metadata'
    | 'status'
  >
>

function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function normalizeLayout(layout?: Partial<WorkspaceLayout>): WorkspaceLayout {
  return Object.fromEntries(
    Object.entries(DEFAULT_LAYOUT).map(([key, fallback]) => {
      const layoutKey = key as keyof WorkspaceLayout
      const value = layout?.[layoutKey]
      const limits = LAYOUT_LIMITS[layoutKey]
      const numericValue = typeof value === 'number' && Number.isFinite(value) ? value : fallback

      return [layoutKey, clamp(numericValue, limits.min, limits.max)]
    })
  ) as WorkspaceLayout
}

function createEmptyTerminalForm(): TerminalForm {
  return {
    name: '',
    kind: 'ai',
    cwd: '',
    commandsText: ''
  }
}

function createRunningSession(config: TerminalConfig): RunningSession {
  const now = new Date().toISOString()

  return {
    id: createId('session'),
    projectId: config.projectId,
    configId: config.id,
    name: config.name,
    kind: config.kind,
    cwd: config.cwd,
    commands: config.commands,
    status: 'starting',
    metadata: config.cwd || 'home folder',
    startedAt: now,
    lastActivityAt: now
  }
}

function commandsFromText(commandsText: string): string[] {
  return commandsText
    .split('\n')
    .map((command) => command.trim())
    .filter(Boolean)
}

function commandsToText(commands: string[]): string {
  return commands.join('\n')
}

function getProjectSummary(project: Project, configs: TerminalConfig[]): string {
  const configuredCount = configs.filter((config) => config.projectId === project.id).length
  const suffix = configuredCount === 1 ? 'terminal' : 'terminals'

  return `${configuredCount} configured ${suffix} - ${project.description || 'No description'}`
}

function getTerminalDetail(config: TerminalConfig): string {
  const command = config.commands.length > 0 ? config.commands.join(' -> ') : 'interactive shell'
  return `${command} - ${config.cwd || 'home folder'}`
}

function isLiveSession(session: RunningSession): boolean {
  return ACTIVE_SESSION_STATUSES.has(session.status)
}

function getStatusLabel(status: RunningSessionStatus): string {
  return SESSION_STATUS_LABELS[status]
}

function getTimeMs(value?: string): number | null {
  if (!value) return null

  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : null
}

function formatDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000))
  if (totalSeconds < 1) return '<1s'
  if (totalSeconds < 60) return `${totalSeconds}s`

  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes < 60) return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`

  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`
}

function getSessionDurationMs(session: RunningSession): number | null {
  if (typeof session.durationMs === 'number') return session.durationMs

  const startedAt = getTimeMs(session.startedAt)
  if (!startedAt) return null

  const endedAt = getTimeMs(session.endedAt) ?? Date.now()
  return Math.max(0, endedAt - startedAt)
}

function getSessionDurationLabel(session: RunningSession): string | null {
  const durationMs = getSessionDurationMs(session)
  return typeof durationMs === 'number' ? formatDuration(durationMs) : null
}

function getLastActivityLabel(session: RunningSession): string | null {
  const lastActivityAt = getTimeMs(session.lastActivityAt)
  if (!lastActivityAt) return null

  const secondsAgo = Math.max(0, Math.floor((Date.now() - lastActivityAt) / 1000))
  if (secondsAgo < 5) return 'active now'
  if (secondsAgo < 60) return `${secondsAgo}s ago`

  const minutesAgo = Math.floor(secondsAgo / 60)
  if (minutesAgo < 60) return `${minutesAgo}m ago`

  const hoursAgo = Math.floor(minutesAgo / 60)
  return `${hoursAgo}h ago`
}

function getOutputPreview(output: string): string | null {
  const preview = output.replace(ANSI_SEQUENCE_PATTERN, '').replace(/\s+/g, ' ').trim()

  if (!preview) return null
  return preview.length > 120 ? preview.slice(-120) : preview
}

function getSessionCardDetail(session: RunningSession): string {
  const duration = getSessionDurationLabel(session)
  const exit = typeof session.exitCode === 'number' ? `exit ${session.exitCode}` : null
  const details = [getStatusLabel(session.status), duration, exit].filter(Boolean)

  return details.join(' - ')
}

function getActiveSessionSummary(session: RunningSession): string {
  const duration = getSessionDurationLabel(session)
  const activity = getLastActivityLabel(session)
  const exit = typeof session.exitCode === 'number' ? `exit ${session.exitCode}` : null
  const details = [session.metadata, duration ? `duration ${duration}` : null, activity, exit]
    .filter(Boolean)
    .join(' - ')

  return session.lastOutputPreview ? `${details} - ${session.lastOutputPreview}` : details
}

function getProjectLiveLabel(projectId: string, runningSessions: RunningSession[]): string {
  const liveCount = runningSessions.filter(
    (session) => session.projectId === projectId && isLiveSession(session)
  ).length

  if (liveCount === 1) return '1 live'
  if (liveCount > 1) return `${liveCount} live`
  return 'ready'
}

function getLiveConfigIds(projectId: string, runningSessions: RunningSession[]): Set<string> {
  return new Set(
    runningSessions
      .filter((session) => session.projectId === projectId && isLiveSession(session))
      .map((session) => session.configId)
  )
}

function getCompanionMessage(session: RunningSession | null): string {
  if (!session) return 'Workspace pronto.'
  if (session.status === 'starting') return `${session.name} esta iniciando.`
  if (session.status === 'running') return `${session.name} esta ativo.`
  if (session.status === 'done')
    return `${session.name} terminou em ${getSessionDurationLabel(session) ?? 'pouco tempo'}.`
  return `${session.name} precisa de atencao.`
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

function App(): React.JSX.Element {
  const [projects, setProjects] = useState<Project[]>([])
  const [terminalConfigs, setTerminalConfigs] = useState<TerminalConfig[]>([])
  const [runningSessions, setRunningSessions] = useState<RunningSession[]>([])
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [configLoaded, setConfigLoaded] = useState(false)
  const [projectForm, setProjectForm] = useState<ProjectForm | null>(null)
  const [terminalForm, setTerminalForm] = useState<TerminalForm | null>(null)
  const [startSelection, setStartSelection] = useState<StartWorkspaceSelection | null>(null)
  const [layout, setLayout] = useState<WorkspaceLayout>(DEFAULT_LAYOUT)
  const [companionBridgeState, setCompanionBridgeState] = useState<CompanionBridgeState>(
    DEFAULT_COMPANION_BRIDGE_STATE
  )

  const activeProject = projects.find((project) => project.id === activeProjectId) ?? null
  const activeProjectConfigs = activeProject
    ? terminalConfigs.filter((config) => config.projectId === activeProject.id)
    : []
  const activeProjectSessions = activeProject
    ? runningSessions.filter((session) => session.projectId === activeProject.id)
    : []
  const activeSession =
    (activeProject
      ? runningSessions.find(
          (session) => session.id === activeSessionId && session.projectId === activeProject.id
        )
      : null) ??
    activeProjectSessions[0] ??
    null
  const activeProjectColor = activeProject?.color ?? PROJECT_COLORS[0]
  const activeStyle = {
    '--active-project-color': activeProjectColor,
    '--rail-width': `${layout.railWidth}px`,
    '--companion-width': `${layout.companionWidth}px`,
    '--projects-height': `${layout.projectsHeight}px`,
    '--terminals-height': `${layout.terminalsHeight}px`
  } as CSSProperties
  const startProject = startSelection
    ? (projects.find((project) => project.id === startSelection.projectId) ?? null)
    : null
  const startProjectConfigs = startProject
    ? terminalConfigs.filter((config) => config.projectId === startProject.id)
    : []
  const startProjectLiveConfigIds = startProject
    ? getLiveConfigIds(startProject.id, runningSessions)
    : new Set<string>()
  const selectableStartConfigs = startProjectConfigs.filter(
    (config) => !startProjectLiveConfigIds.has(config.id)
  )
  const selectedStartConfigs = startSelection
    ? selectableStartConfigs.filter((config) =>
        startSelection.selectedConfigIds.includes(config.id)
      )
    : []

  useEffect(() => {
    let mounted = true

    window.api.workspace
      .loadConfig()
      .then((config) => {
        if (!mounted) return

        if (config) {
          setProjects(config.projects)
          setTerminalConfigs(config.terminalConfigs)
          setActiveProjectId(
            config.projects.find((project) => project.id === config.activeProjectId)?.id ??
              config.projects[0]?.id ??
              null
          )
          setLayout(normalizeLayout(config.layout))
        }
      })
      .finally(() => {
        if (mounted) setConfigLoaded(true)
      })

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (!configLoaded) return

    const saveTimer = window.setTimeout(() => {
      void window.api.workspace.saveConfig({
        projects,
        terminalConfigs,
        activeProjectId: activeProjectId ?? undefined,
        layout
      })
    }, 180)

    return () => window.clearTimeout(saveTimer)
  }, [activeProjectId, configLoaded, layout, projects, terminalConfigs])

  useEffect(() => {
    return window.api.view.onResetLayout(() => {
      setLayout(DEFAULT_LAYOUT)
    })
  }, [])

  useEffect(() => {
    let mounted = true

    const loadBridgeState = (): void => {
      window.api.companion
        .loadBridgeState()
        .then((state) => {
          if (mounted) setCompanionBridgeState(state)
        })
        .catch((error: unknown) => {
          console.error('Failed to load companion bridge state', error)
        })
    }

    loadBridgeState()
    const bridgeTimer = window.setInterval(loadBridgeState, 1200)

    return () => {
      mounted = false
      window.clearInterval(bridgeTimer)
    }
  }, [])

  const updateSession = useCallback((sessionId: string, patch: RunningSessionPatch): void => {
    setRunningSessions((currentSessions) =>
      currentSessions.map((session) =>
        session.id === sessionId ? { ...session, ...patch } : session
      )
    )
  }, [])

  const markSessionExited = useCallback(
    (sessionId: string, exitCode: number, exitSignal?: number): void => {
      const endedAt = new Date().toISOString()

      setRunningSessions((currentSessions) =>
        currentSessions.map((session) => {
          if (session.id !== sessionId) return session

          const startedAt = getTimeMs(session.startedAt)
          const durationMs = startedAt ? Math.max(0, Date.parse(endedAt) - startedAt) : undefined
          const status = session.status === 'error' || exitCode !== 0 ? 'error' : 'done'

          return {
            ...session,
            durationMs,
            endedAt,
            exitCode,
            exitSignal,
            lastActivityAt: endedAt,
            status
          }
        })
      )
    },
    []
  )

  const markSessionStarted = useCallback(
    (sessionId: string, metadata: string): void => {
      updateSession(sessionId, {
        lastActivityAt: new Date().toISOString(),
        metadata,
        status: 'running'
      })
    },
    [updateSession]
  )

  const markSessionStartError = useCallback(
    (sessionId: string, errorMessage: string): void => {
      const endedAt = new Date().toISOString()

      updateSession(sessionId, {
        endedAt,
        lastActivityAt: endedAt,
        lastOutputPreview: errorMessage,
        status: 'error'
      })
    },
    [updateSession]
  )

  const updateSessionActivity = useCallback(
    (sessionId: string, output: string): void => {
      const preview = getOutputPreview(output)

      updateSession(sessionId, {
        lastActivityAt: new Date().toISOString(),
        ...(preview ? { lastOutputPreview: preview } : {})
      })
    },
    [updateSession]
  )

  const selectProject = (projectId: string): void => {
    setActiveProjectId(projectId)
    setActiveSessionId(
      runningSessions.find((session) => session.projectId === projectId)?.id ?? null
    )
  }

  const startLayoutResize = (
    event: React.PointerEvent<HTMLButtonElement>,
    target: LayoutResizeTarget
  ): void => {
    event.preventDefault()

    const startX = event.clientX
    const startY = event.clientY
    const startLayout = layout
    const resizeClass = target === 'railWidth' || target === 'companionWidth' ? 'column' : 'row'

    document.body.classList.add('is-resizing', `is-resizing--${resizeClass}`)

    const updateLayout = (moveEvent: PointerEvent): void => {
      const deltaX = moveEvent.clientX - startX
      const deltaY = moveEvent.clientY - startY
      const nextLayout = { ...startLayout }

      if (target === 'railWidth') {
        nextLayout.railWidth = startLayout.railWidth + deltaX
      } else if (target === 'companionWidth') {
        nextLayout.companionWidth = startLayout.companionWidth - deltaX
      } else if (target === 'projectsHeight') {
        nextLayout.projectsHeight = startLayout.projectsHeight + deltaY
      } else {
        nextLayout.terminalsHeight = startLayout.terminalsHeight + deltaY
      }

      setLayout(normalizeLayout(nextLayout))
    }

    const stopResize = (): void => {
      document.body.classList.remove('is-resizing', `is-resizing--${resizeClass}`)
      window.removeEventListener('pointermove', updateLayout)
      window.removeEventListener('pointerup', stopResize)
      window.removeEventListener('pointercancel', stopResize)
    }

    window.addEventListener('pointermove', updateLayout)
    window.addEventListener('pointerup', stopResize)
    window.addEventListener('pointercancel', stopResize)
  }

  const startConfig = (config: TerminalConfig): void => {
    const existingSession = runningSessions.find(
      (session) => session.configId === config.id && isLiveSession(session)
    )

    if (existingSession) {
      setActiveProjectId(existingSession.projectId)
      setActiveSessionId(existingSession.id)
      return
    }

    const session = createRunningSession(config)
    setRunningSessions((currentSessions) => [...currentSessions, session])
    setActiveProjectId(config.projectId)
    setActiveSessionId(session.id)
  }

  const openStartWorkspace = (): void => {
    if (!activeProject) return

    const liveConfigIds = getLiveConfigIds(activeProject.id, runningSessions)
    const selectedConfigIds = activeProjectConfigs
      .filter((config) => !liveConfigIds.has(config.id))
      .map((config) => config.id)

    setStartSelection({
      projectId: activeProject.id,
      selectedConfigIds
    })
  }

  const selectStartCategory = (category: 'all' | 'ai' | 'run'): void => {
    setStartSelection((currentSelection) => {
      if (!currentSelection) return currentSelection

      const liveConfigIds = getLiveConfigIds(currentSelection.projectId, runningSessions)
      const availableConfigs = terminalConfigs.filter(
        (config) => config.projectId === currentSelection.projectId && !liveConfigIds.has(config.id)
      )
      const selectedConfigIds = availableConfigs
        .filter((config) => {
          if (category === 'ai') return config.kind === 'ai'
          if (category === 'run') return config.kind !== 'ai'
          return true
        })
        .map((config) => config.id)

      return {
        ...currentSelection,
        selectedConfigIds
      }
    })
  }

  const toggleStartConfig = (configId: string): void => {
    setStartSelection((currentSelection) => {
      if (!currentSelection) return currentSelection

      const selectedConfigIds = currentSelection.selectedConfigIds.includes(configId)
        ? currentSelection.selectedConfigIds.filter(
            (selectedConfigId) => selectedConfigId !== configId
          )
        : [...currentSelection.selectedConfigIds, configId]

      return {
        ...currentSelection,
        selectedConfigIds
      }
    })
  }

  const startSelectedWorkspaceConfigs = (): void => {
    if (!startSelection) return

    const liveConfigIds = getLiveConfigIds(startSelection.projectId, runningSessions)
    const sessionsToStart = terminalConfigs
      .filter(
        (config) =>
          config.projectId === startSelection.projectId &&
          startSelection.selectedConfigIds.includes(config.id) &&
          !liveConfigIds.has(config.id)
      )
      .map(createRunningSession)
    const firstExistingSession = runningSessions.find(
      (session) => session.projectId === startSelection.projectId && isLiveSession(session)
    )

    setStartSelection(null)

    if (sessionsToStart.length > 0) {
      setRunningSessions((currentSessions) => [...currentSessions, ...sessionsToStart])
      setActiveProjectId(startSelection.projectId)
      setActiveSessionId(sessionsToStart[0].id)
      return
    }

    if (firstExistingSession) {
      setActiveProjectId(firstExistingSession.projectId)
      setActiveSessionId(firstExistingSession.id)
    }
  }

  const stopSession = (sessionId: string): void => {
    const nextActiveSession = runningSessions.find(
      (session) => session.id !== sessionId && session.projectId === activeProject?.id
    )

    setRunningSessions((currentSessions) =>
      currentSessions.filter((session) => session.id !== sessionId)
    )

    if (activeSession?.id === sessionId) {
      setActiveSessionId(nextActiveSession?.id ?? null)
    }
  }

  const openCreateProject = (): void => {
    setProjectForm({
      name: '',
      description: '',
      color: PROJECT_COLORS[projects.length % PROJECT_COLORS.length]
    })
  }

  const openEditProject = (project: Project): void => {
    setProjectForm({
      id: project.id,
      name: project.name,
      description: project.description,
      color: project.color
    })
  }

  const saveProjectForm = (): void => {
    if (!projectForm?.name.trim()) return

    if (projectForm.id) {
      setProjects((currentProjects) =>
        currentProjects.map((project) =>
          project.id === projectForm.id
            ? {
                ...project,
                name: projectForm.name.trim(),
                description: projectForm.description.trim(),
                color: projectForm.color
              }
            : project
        )
      )
      setProjectForm(null)
      return
    }

    const project: Project = {
      id: createId('project'),
      name: projectForm.name.trim(),
      description: projectForm.description.trim(),
      color: projectForm.color
    }

    setProjects((currentProjects) => [...currentProjects, project])
    setActiveProjectId(project.id)
    setActiveSessionId(null)
    setProjectForm(null)
  }

  const openCreateTerminal = (): void => {
    if (!activeProject) return

    setTerminalForm(createEmptyTerminalForm())
  }

  const openEditTerminal = (config: TerminalConfig): void => {
    setTerminalForm({
      id: config.id,
      name: config.name,
      kind: config.kind,
      cwd: config.cwd,
      commandsText: commandsToText(config.commands)
    })
  }

  const pickTerminalFolder = async (): Promise<void> => {
    const folder = await window.api.workspace.pickFolder()
    if (!folder) return

    setTerminalForm((currentForm) =>
      currentForm
        ? {
            ...currentForm,
            cwd: folder.path,
            name: currentForm.name || folder.name
          }
        : currentForm
    )
  }

  const saveTerminalForm = (): void => {
    if (!activeProject || !terminalForm?.name.trim()) return

    const commands = commandsFromText(terminalForm.commandsText)
    const nextConfig: TerminalConfig = {
      id: terminalForm.id ?? createId('terminal'),
      projectId: activeProject.id,
      name: terminalForm.name.trim(),
      kind: terminalForm.kind,
      cwd: terminalForm.cwd.trim(),
      commands
    }

    setTerminalConfigs((currentConfigs) => {
      if (terminalForm.id) {
        return currentConfigs.map((config) => (config.id === terminalForm.id ? nextConfig : config))
      }

      return [...currentConfigs, nextConfig]
    })
    setTerminalForm(null)
  }

  const deleteTerminalConfig = (configId: string): void => {
    setTerminalConfigs((currentConfigs) =>
      currentConfigs.filter((config) => config.id !== configId)
    )
  }

  const companionMessage = activeProject
    ? getCompanionMessage(activeSession)
    : 'Create a workspace to get started.'
  const companionTerminalMessages: CompanionBridgeMessage[] =
    companionBridgeState.messages.length > 0
      ? companionBridgeState.messages.slice(-8)
      : [
          {
            id: 'local-companion-message',
            cliState: activeSession?.status === 'error' ? 'error' : 'idle',
            createdAt: new Date().toISOString(),
            projectColor: activeProjectColor,
            projectName: activeProject?.name ?? 'Pixel Companion',
            source: 'app',
            summary: companionMessage,
            title: activeSession?.name ?? 'Ready'
          }
        ]
  const companionTerminalState =
    companionBridgeState.messages.length > 0
      ? companionBridgeState.currentState
      : activeSession?.status === 'error'
        ? 'error'
        : 'idle'
  const terminalTitle =
    activeSession?.name ?? (activeProject ? 'Workspace' : 'No workspace selected')
  const terminalStatus = activeSession ? getStatusLabel(activeSession.status) : 'Ready'
  const terminalStatusKey = activeSession?.status ?? 'ready'
  const activeSessionKind = activeSession?.kind ?? 'shell'
  const selectedSessionId = activeSession?.id ?? null
  const sessionSummary = activeSession
    ? getActiveSessionSummary(activeSession)
    : activeProject
      ? getProjectSummary(activeProject, terminalConfigs)
      : 'No workspace configured yet.'

  return (
    <main className="app-shell" style={activeStyle}>
      <aside className="workspace-rail">
        <div className="workspace-rail-scroll">
          <div className="brand-lockup">
            <span className="brand-mark" aria-hidden="true" />
            <div className="brand-title-row">
              <strong>Pixel Companion</strong>
              <span className="brand-version">v1.0.0</span>
            </div>
          </div>

          <section className="rail-section rail-section--projects" aria-label="Projects">
            <div className="rail-header">
              <span>Projects</span>
              <button className="secondary-button" type="button" onClick={openCreateProject}>
                Add workspace
              </button>
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
                    onClick={() => selectProject(project.id)}
                  >
                    <span className="project-dot" aria-hidden="true" />
                    <span>{project.name}</span>
                    <small>{getProjectLiveLabel(project.id, runningSessions)}</small>
                  </button>
                  <button
                    className="icon-button"
                    type="button"
                    title={`Edit ${project.name}`}
                    onClick={() => openEditProject(project)}
                  >
                    Settings
                  </button>
                </div>
              ))}
            </div>
          </section>

          <button
            className="resize-handle resize-handle--row"
            type="button"
            aria-label="Resize projects"
            onPointerDown={(event) => startLayoutResize(event, 'projectsHeight')}
          />

          <section className="rail-section rail-section--actions" aria-label="Workspace actions">
            {activeProject ? (
              <button className="primary-button" type="button" onClick={openStartWorkspace}>
                Start {activeProject.name}
              </button>
            ) : (
              <button className="primary-button" type="button" onClick={openCreateProject}>
                Add workspace
              </button>
            )}
          </section>

          <section className="rail-section rail-section--config" aria-label="Configured terminals">
            <div className="rail-header">
              <span>Configured terminals</span>
              <button
                className="secondary-button"
                type="button"
                disabled={!activeProject}
                onClick={openCreateTerminal}
              >
                Add terminal
              </button>
            </div>
            <div className="template-list">
              {!activeProject && (
                <div className="empty-list-state">Select or create a workspace first.</div>
              )}

              {activeProjectConfigs.map((config) => (
                <div key={config.id} className="template-row">
                  <button
                    className="template-item"
                    type="button"
                    onClick={() => startConfig(config)}
                  >
                    <span className={`kind-badge kind-badge--${config.kind}`}>
                      {KIND_LABELS[config.kind]}
                    </span>
                    <strong>{config.name}</strong>
                    <small>{getTerminalDetail(config)}</small>
                  </button>
                  <button
                    className="icon-button"
                    type="button"
                    title={`Configure ${config.name}`}
                    onClick={() => openEditTerminal(config)}
                  >
                    Settings
                  </button>
                </div>
              ))}
            </div>
          </section>

          <button
            className="resize-handle resize-handle--row"
            type="button"
            aria-label="Resize configured terminals"
            onPointerDown={(event) => startLayoutResize(event, 'terminalsHeight')}
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
                    onClick={() => setActiveSessionId(session.id)}
                  >
                    <span className={`kind-badge kind-badge--${session.kind}`}>
                      {KIND_LABELS[session.kind]}
                    </span>
                    <strong>{session.name}</strong>
                    <small>{getSessionCardDetail(session)}</small>
                  </button>
                  <button
                    className="session-stop"
                    type="button"
                    onClick={() => stopSession(session.id)}
                  >
                    {isLiveSession(session) ? 'Stop' : 'Clear'}
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>
      </aside>

      <button
        className="resize-handle resize-handle--column"
        type="button"
        aria-label="Resize project rail"
        onPointerDown={(event) => startLayoutResize(event, 'railWidth')}
      />

      <section className="session-panel" aria-label="Session preview">
        <header className="session-header">
          <div>
            <span className="eyebrow">{activeProject?.name ?? 'Pixel Companion'}</span>
            <h1>{terminalTitle}</h1>
            <p>{sessionSummary}</p>
          </div>
          <div className="session-header-actions">
            <span className={`kind-badge kind-badge--${activeSessionKind}`}>
              {KIND_LABELS[activeSessionKind]}
            </span>
            <span className={`status-pill status-pill--${terminalStatusKey}`}>
              {terminalStatus}
            </span>
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
                  onSessionActivity={updateSessionActivity}
                  onSessionExit={markSessionExited}
                  onSessionStartError={markSessionStartError}
                  onSessionStarted={markSessionStarted}
                />
              </div>
            ))}
          </div>
          {!activeSession && (
            <div className="empty-terminal">
              <strong>{activeProject?.name ?? 'No workspaces yet'}</strong>
              {!activeProject ? (
                <button className="primary-button" type="button" onClick={openCreateProject}>
                  Add workspace
                </button>
              ) : activeProjectConfigs.length === 0 ? (
                <button className="primary-button" type="button" onClick={openCreateTerminal}>
                  Add terminal
                </button>
              ) : (
                <button className="primary-button" type="button" onClick={openStartWorkspace}>
                  Start workspace
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      <button
        className="resize-handle resize-handle--column"
        type="button"
        aria-label="Resize companion panel"
        onPointerDown={(event) => startLayoutResize(event, 'companionWidth')}
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
              <strong>{activeProject?.name ?? 'Pixel Companion'}</strong>
              <small>{getCompanionStateLabel(companionTerminalState)}</small>
            </header>
            <div className="companion-terminal-screen">
              {companionTerminalMessages.map((message) => (
                <article
                  key={message.id}
                  className={`companion-line companion-line--${message.cliState}`}
                  style={
                    {
                      '--message-color': message.projectColor ?? activeProjectColor
                    } as CSSProperties
                  }
                >
                  <div className="companion-line-meta">
                    <span>{formatCompanionTime(message.createdAt)}</span>
                    <strong>{message.agentName ?? 'companion'}</strong>
                    {message.projectName && <small>{message.projectName}</small>}
                  </div>
                  <p>{message.summary}</p>
                  {message.details && <pre>{message.details}</pre>}
                </article>
              ))}
            </div>
          </div>
          <div
            className={`pixel-companion pixel-companion--${companionTerminalState}`}
            aria-hidden="true"
          >
            <span className="pixel-eye pixel-eye--left" />
            <span className="pixel-eye pixel-eye--right" />
            <span className="pixel-mouth" />
          </div>
          <div className="shadow" />
        </div>
      </aside>

      {startSelection && startProject && (
        <div className="modal-backdrop">
          <section className="modal modal--wide" aria-label={`Start ${startProject.name}`}>
            <header className="modal-header">
              <div>
                <h2>Start {startProject.name}</h2>
                <p className="modal-subtitle">Choose which terminals should launch now.</p>
              </div>
              <button className="icon-button" type="button" onClick={() => setStartSelection(null)}>
                Close
              </button>
            </header>

            <div className="start-filter-row" role="group" aria-label="Start selection filters">
              <button
                className="secondary-button"
                type="button"
                onClick={() => selectStartCategory('all')}
              >
                All
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={() => selectStartCategory('ai')}
              >
                AI only
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={() => selectStartCategory('run')}
              >
                Run only
              </button>
            </div>

            <div className="start-config-list">
              {startProjectConfigs.length === 0 && (
                <div className="empty-start-state">No configured terminals yet.</div>
              )}

              {startProjectConfigs.map((config) => {
                const isLive = startProjectLiveConfigIds.has(config.id)
                const isSelected = startSelection.selectedConfigIds.includes(config.id) && !isLive

                return (
                  <label
                    key={config.id}
                    className={`start-config-item${isLive ? ' start-config-item--disabled' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={isLive}
                      onChange={() => toggleStartConfig(config.id)}
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
              <span className="selection-count">{selectedStartConfigs.length} selected</span>
              <div className="modal-action-buttons">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => setStartSelection(null)}
                >
                  Cancel
                </button>
                <button
                  className="primary-button"
                  type="button"
                  disabled={selectedStartConfigs.length === 0}
                  onClick={startSelectedWorkspaceConfigs}
                >
                  Start selected
                </button>
              </div>
            </footer>
          </section>
        </div>
      )}

      {projectForm && (
        <div className="modal-backdrop">
          <section className="modal" aria-label="Workspace settings">
            <header className="modal-header">
              <h2>{projectForm.id ? 'Edit workspace' : 'Add workspace'}</h2>
              <button className="icon-button" type="button" onClick={() => setProjectForm(null)}>
                Close
              </button>
            </header>
            <label>
              <span>Name</span>
              <input
                value={projectForm.name}
                autoFocus
                onChange={(event) =>
                  setProjectForm((currentForm) =>
                    currentForm ? { ...currentForm, name: event.target.value } : currentForm
                  )
                }
              />
            </label>
            <label>
              <span>Description</span>
              <input
                value={projectForm.description}
                onChange={(event) =>
                  setProjectForm((currentForm) =>
                    currentForm ? { ...currentForm, description: event.target.value } : currentForm
                  )
                }
              />
            </label>
            <label>
              <span>Color</span>
              <input
                type="color"
                value={projectForm.color}
                onChange={(event) =>
                  setProjectForm((currentForm) =>
                    currentForm ? { ...currentForm, color: event.target.value } : currentForm
                  )
                }
              />
            </label>
            <footer className="modal-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => setProjectForm(null)}
              >
                Cancel
              </button>
              <button className="primary-button" type="button" onClick={saveProjectForm}>
                Save workspace
              </button>
            </footer>
          </section>
        </div>
      )}

      {terminalForm && (
        <div className="modal-backdrop">
          <section className="modal modal--wide" aria-label="Terminal settings">
            <header className="modal-header">
              <h2>{terminalForm.id ? 'Configure terminal' : 'Add terminal'}</h2>
              <button className="icon-button" type="button" onClick={() => setTerminalForm(null)}>
                Close
              </button>
            </header>
            <label>
              <span>Name</span>
              <input
                value={terminalForm.name}
                autoFocus
                onChange={(event) =>
                  setTerminalForm((currentForm) =>
                    currentForm ? { ...currentForm, name: event.target.value } : currentForm
                  )
                }
              />
            </label>
            <label>
              <span>Type</span>
              <select
                value={terminalForm.kind}
                onChange={(event) =>
                  setTerminalForm((currentForm) =>
                    currentForm
                      ? { ...currentForm, kind: event.target.value as SessionKind }
                      : currentForm
                  )
                }
              >
                {Object.entries(KIND_LABELS).map(([kind, label]) => (
                  <option key={kind} value={kind}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Folder</span>
              <div className="input-row">
                <input
                  value={terminalForm.cwd}
                  onChange={(event) =>
                    setTerminalForm((currentForm) =>
                      currentForm ? { ...currentForm, cwd: event.target.value } : currentForm
                    )
                  }
                />
                <button className="secondary-button" type="button" onClick={pickTerminalFolder}>
                  Pick
                </button>
              </div>
            </label>
            <label>
              <span>Commands</span>
              <textarea
                rows={6}
                value={terminalForm.commandsText}
                onChange={(event) =>
                  setTerminalForm((currentForm) =>
                    currentForm ? { ...currentForm, commandsText: event.target.value } : currentForm
                  )
                }
              />
            </label>
            <footer className="modal-actions">
              {terminalForm.id && (
                <button
                  className="danger-button"
                  type="button"
                  onClick={() => {
                    deleteTerminalConfig(terminalForm.id!)
                    setTerminalForm(null)
                  }}
                >
                  Delete
                </button>
              )}
              <button
                className="secondary-button"
                type="button"
                onClick={() => setTerminalForm(null)}
              >
                Cancel
              </button>
              <button className="primary-button" type="button" onClick={saveTerminalForm}>
                Save terminal
              </button>
            </footer>
          </section>
        </div>
      )}
    </main>
  )
}

export default App
