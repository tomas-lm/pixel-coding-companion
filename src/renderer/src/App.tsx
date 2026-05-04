import { useCallback, useState, type CSSProperties } from 'react'
import type { CompanionBridgeMessage } from '../../shared/companion'
import type {
  Project,
  PromptTemplate,
  RunningSession,
  TerminalConfig
} from '../../shared/workspace'
import {
  ActivitySidebar,
  type ActivitySidebarItem,
  type ActivitySidebarItemId
} from './components/ActivitySidebar'
import { CompanionCatalogPanel } from './components/CompanionCatalogPanel'
import { CompanionPanel } from './components/CompanionPanel'
import { LoadingScreen } from './components/LoadingScreen'
import { OnboardingFlow, type OnboardingResult } from './components/OnboardingFlow'
import { ProjectFormModal } from './components/ProjectFormModal'
import { PromptTemplatePickerModal } from './components/PromptTemplatePickerModal'
import { PromptTemplatesPanel } from './components/PromptTemplatesPanel'
import { StarterSelectionPage } from './components/StarterSelectionPage'
import { StartWorkspaceModal } from './components/StartWorkspaceModal'
import { TerminalFormModal } from './components/TerminalFormModal'
import { TerminalWorkspacePanel } from './components/TerminalWorkspacePanel'
import { WorkspaceRail } from './components/WorkspaceRail'
import {
  COMPANION_REGISTRY,
  STARTER_COMPANION_ID,
  STARTER_COMPANION_IDS,
  getCompanionStageForLevel
} from './companions/companionRegistry'
import { getActiveCompanionProgress, getCompanionMessageColor } from './app/companionSelectors'
import { getPromptTemplateProjectPath, getPromptTemplateSendStatus } from './app/promptTemplates'
import type { ProjectForm } from './app/projectForms'
import { createRunningSession } from './app/runningSessions'
import {
  commandsFromText,
  commandsToText,
  getActiveSessionSummary,
  getCompanionMessage,
  getLiveConfigIds,
  getOutputPreview,
  getProjectSummary,
  getStatusLabel,
  getTimeMs,
  isLiveSession
} from './app/sessionDisplay'
import { createEmptyTerminalForm, type TerminalForm } from './app/terminalForms'
import { useCompanionBridge } from './hooks/useCompanionBridge'
import { useTerminalEvents } from './hooks/useTerminalEvents'
import { useTerminalHoverCard } from './hooks/useTerminalHoverCard'
import { useWorkspaceConfig } from './hooks/useWorkspaceConfig'
import { useWorkspaceLayout } from './hooks/useWorkspaceLayout'

const COMPANION_NAME = 'Ghou'
const PROJECT_COLORS = ['#4ea1ff', '#ef5b5b', '#f7d56f', '#7fe7dc', '#c084fc', '#34d399']
type StartWorkspaceSelection = {
  projectId: string
  selectedConfigIds: string[]
  startWithPixel: boolean
}

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

function App(): React.JSX.Element {
  const [runningSessions, setRunningSessions] = useState<RunningSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [projectForm, setProjectForm] = useState<ProjectForm | null>(null)
  const [terminalForm, setTerminalForm] = useState<TerminalForm | null>(null)
  const [startSelection, setStartSelection] = useState<StartWorkspaceSelection | null>(null)
  const { applyTerminalTheme, layout, setLayout, startLayoutResize, terminalThemeId } =
    useWorkspaceLayout()
  const {
    activeProjectId,
    configLoaded,
    promptTemplates,
    projects,
    setActiveProjectId,
    setPromptTemplates,
    setProjects,
    setTerminalConfigs,
    terminalConfigs
  } = useWorkspaceConfig({
    applyTerminalTheme,
    layout,
    setLayout,
    terminalThemeId
  })
  const [activeActivityItemId, setActiveActivityItemId] =
    useState<ActivitySidebarItemId>('terminal')
  const { clearTerminalHoverCard, scheduleTerminalHoverCard, terminalHoverCard } =
    useTerminalHoverCard()
  const {
    companionBridgeState,
    companionProgress,
    companionStoreLoaded,
    companionStoreState,
    setCompanionProgress,
    setCompanionStoreState
  } = useCompanionBridge(COMPANION_NAME)
  const [starterSelectionError, setStarterSelectionError] = useState<string | null>(null)
  const [isSelectingStarter, setIsSelectingStarter] = useState(false)
  const [promptPickerOpen, setPromptPickerOpen] = useState(false)

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
  const shouldShowOnboarding = configLoaded && projects.length === 0
  const shouldShowStarterSelection =
    configLoaded &&
    projects.length > 0 &&
    companionStoreLoaded &&
    companionStoreState !== null &&
    !companionStoreState.starterSelected
  const starterCompanions = COMPANION_REGISTRY.filter((companion) =>
    STARTER_COMPANION_IDS.includes(companion.id as (typeof STARTER_COMPANION_IDS)[number])
  )
  const selectedStartPixelConfigs = selectedStartConfigs.filter(
    (config) => config.kind === 'ai' && config.commands.length > 0
  )
  const selectedStartPixelLabel = selectedStartPixelConfigs.length === 1 ? 'terminal' : 'terminals'
  const activitySidebarItems: ActivitySidebarItem[] = [
    {
      icon: 'terminal',
      id: 'terminal',
      label: 'Terminal workspace'
    },
    {
      icon: 'companion',
      id: 'companions',
      label: 'Companion selector'
    },
    {
      icon: 'prompts',
      id: 'prompts',
      label: 'Prompt templates'
    }
  ]
  const activeCompanionId = companionStoreState?.activeCompanionId ?? STARTER_COMPANION_ID
  const activeCompanionDefinition =
    COMPANION_REGISTRY.find((companion) => companion.id === activeCompanionId) ??
    COMPANION_REGISTRY[0]
  const activeCompanionProgress = getActiveCompanionProgress(companionProgress, companionStoreState)
  const activeCompanionName = activeCompanionProgress.name
  const activeCompanionStage = getCompanionStageForLevel(
    activeCompanionDefinition,
    activeCompanionProgress.level
  )

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

  useTerminalEvents(markSessionExited)

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

  const startConfig = (config: TerminalConfig): void => {
    const existingSession = runningSessions.find(
      (session) => session.configId === config.id && isLiveSession(session)
    )

    if (existingSession) {
      setActiveProjectId(existingSession.projectId)
      setActiveSessionId(existingSession.id)
      return
    }

    const project = projects.find((candidate) => candidate.id === config.projectId) ?? null
    const session = createRunningSession(config, project, {
      fallbackProjectColor: PROJECT_COLORS[0],
      useStartWithPixel: config.kind === 'ai'
    })
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
      selectedConfigIds,
      startWithPixel: true
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

  const toggleStartWithPixel = (): void => {
    setStartSelection((currentSelection) =>
      currentSelection
        ? {
            ...currentSelection,
            startWithPixel: !currentSelection.startWithPixel
          }
        : currentSelection
    )
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
      .map((config) => {
        const project = projects.find((candidate) => candidate.id === config.projectId) ?? null
        return createRunningSession(config, project, {
          fallbackProjectColor: PROJECT_COLORS[0],
          useStartWithPixel: startSelection.startWithPixel
        })
      })
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
    const sessionToStop = runningSessions.find((session) => session.id === sessionId)
    const nextActiveSession = runningSessions.find(
      (session) => session.id !== sessionId && session.projectId === activeProject?.id
    )

    if (sessionToStop && isLiveSession(sessionToStop)) {
      void window.api.terminal.stop(sessionId)
    }

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

  const savePromptTemplate = (template: PromptTemplate): void => {
    setPromptTemplates((currentTemplates) => {
      if (currentTemplates.some((currentTemplate) => currentTemplate.id === template.id)) {
        return currentTemplates.map((currentTemplate) =>
          currentTemplate.id === template.id ? template : currentTemplate
        )
      }

      return [...currentTemplates, template]
    })
  }

  const deletePromptTemplate = (templateId: string): void => {
    setPromptTemplates((currentTemplates) =>
      currentTemplates.filter((template) => template.id !== templateId)
    )
  }

  const sendPromptToActiveTerminal = (prompt: string): void => {
    if (!activeSession || !isLiveSession(activeSession)) return

    window.api.terminal.write({
      data: `${prompt.trimEnd()}\r`,
      id: activeSession.id
    })
  }

  const completeOnboarding = async ({
    project,
    terminalConfig
  }: OnboardingResult): Promise<void> => {
    const nextProjects = [project]
    const nextTerminalConfigs = [terminalConfig]

    await window.api.workspace.saveConfig({
      projects: nextProjects,
      terminalConfigs: nextTerminalConfigs,
      activeProjectId: project.id,
      layout,
      promptTemplates,
      terminalThemeId
    })

    setProjects(nextProjects)
    setTerminalConfigs(nextTerminalConfigs)
    setActiveProjectId(project.id)
    setActiveSessionId(null)
  }

  const selectStarterCompanion = async (companionId: string): Promise<void> => {
    setIsSelectingStarter(true)
    setStarterSelectionError(null)

    try {
      const result = await window.api.companion.selectStarter({ companionId })

      setCompanionProgress(result.progress)
      setCompanionStoreState(result.storeState)
    } catch (error: unknown) {
      setStarterSelectionError(
        error instanceof Error ? error.message : 'Could not select starter companion.'
      )
    } finally {
      setIsSelectingStarter(false)
    }
  }

  if (!configLoaded) {
    return <LoadingScreen label="Loading setup" title="Loading workspace config" />
  }

  if (shouldShowOnboarding) {
    return (
      <OnboardingFlow
        colors={PROJECT_COLORS}
        onComplete={completeOnboarding}
        onPickFolder={window.api.workspace.pickFolder}
      />
    )
  }

  if (!companionStoreLoaded) {
    return <LoadingScreen label="Loading companions" title="Loading companions" />
  }

  if (shouldShowStarterSelection) {
    return (
      <StarterSelectionPage
        error={starterSelectionError}
        isSaving={isSelectingStarter}
        starters={starterCompanions}
        onSelectStarter={selectStarterCompanion}
      />
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
            title: activeSession?.name ?? COMPANION_NAME
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
  const promptSendStatus = getPromptTemplateSendStatus(activeSession)
  const promptProjectPath = getPromptTemplateProjectPath(activeSession, activeProjectConfigs)
  const sessionSummary = activeSession
    ? getActiveSessionSummary(activeSession)
    : activeProject
      ? getProjectSummary(activeProject, terminalConfigs)
      : 'No workspace configured yet.'

  return (
    <main className="app-shell" style={activeStyle}>
      <ActivitySidebar
        activeItemId={activeActivityItemId}
        items={activitySidebarItems}
        onSelect={setActiveActivityItemId}
      />

      <WorkspaceRail
        activeProject={activeProject}
        activeProjectConfigs={activeProjectConfigs}
        activeProjectSessions={activeProjectSessions}
        projects={projects}
        runningSessions={runningSessions}
        selectedSessionId={selectedSessionId}
        onClearTerminalHoverCard={clearTerminalHoverCard}
        onCreateProject={openCreateProject}
        onCreateTerminal={openCreateTerminal}
        onEditProject={openEditProject}
        onEditTerminal={openEditTerminal}
        onOpenPromptPicker={() => setPromptPickerOpen(true)}
        onResizePointerDown={startLayoutResize}
        onScheduleTerminalHoverCard={scheduleTerminalHoverCard}
        onSelectProject={selectProject}
        onSelectSession={setActiveSessionId}
        onStartConfig={startConfig}
        onStartWorkspace={openStartWorkspace}
        onStopSession={stopSession}
      />

      <button
        className="resize-handle resize-handle--column"
        type="button"
        aria-label="Resize project rail"
        onPointerDown={(event) => startLayoutResize(event, 'railWidth')}
      />

      {activeActivityItemId === 'terminal' ? (
        <TerminalWorkspacePanel
          activeProject={activeProject}
          activeProjectConfigs={activeProjectConfigs}
          activeSession={activeSession}
          activeSessionKind={activeSessionKind}
          runningSessions={runningSessions}
          selectedSessionId={selectedSessionId}
          sessionSummary={sessionSummary}
          terminalStatus={terminalStatus}
          terminalStatusKey={terminalStatusKey}
          terminalThemeId={terminalThemeId}
          terminalTitle={terminalTitle}
          onCreateProject={openCreateProject}
          onCreateTerminal={openCreateTerminal}
          onSessionActivity={updateSessionActivity}
          onSessionStartError={markSessionStartError}
          onSessionStarted={markSessionStarted}
          onStartWorkspace={openStartWorkspace}
        />
      ) : activeActivityItemId === 'prompts' ? (
        <PromptTemplatesPanel
          activeProject={activeProject}
          templates={promptTemplates}
          onDeleteTemplate={deletePromptTemplate}
          onSaveTemplate={savePromptTemplate}
        />
      ) : (
        <CompanionCatalogPanel
          progress={companionProgress}
          storeState={companionStoreState}
          onProgressUpdate={setCompanionProgress}
          onStoreStateUpdate={setCompanionStoreState}
        />
      )}

      <CompanionPanel
        companionName={activeCompanionName}
        companionStage={activeCompanionStage}
        companionState={companionTerminalState}
        getMessageColor={(message) =>
          getCompanionMessageColor(message, projects, terminalConfigs, activeProjectColor)
        }
        messages={companionTerminalMessages}
        onResizePointerDown={(event) => startLayoutResize(event, 'companionWidth')}
        progress={activeCompanionProgress}
      />

      {terminalHoverCard && (
        <div
          className="terminal-hover-card"
          role="tooltip"
          style={{ left: terminalHoverCard.left, top: terminalHoverCard.top }}
        >
          <strong>{terminalHoverCard.title}</strong>
          <span>{terminalHoverCard.description}</span>
          <small>{terminalHoverCard.path}</small>
        </div>
      )}

      {startSelection && startProject && (
        <StartWorkspaceModal
          configs={startProjectConfigs}
          liveConfigIds={startProjectLiveConfigIds}
          project={startProject}
          selectedConfigIds={startSelection.selectedConfigIds}
          selectedCount={selectedStartConfigs.length}
          selectedPixelConfigCount={selectedStartPixelConfigs.length}
          selectedPixelLabel={selectedStartPixelLabel}
          startWithPixel={startSelection.startWithPixel}
          onClose={() => setStartSelection(null)}
          onSelectCategory={selectStartCategory}
          onStartSelected={startSelectedWorkspaceConfigs}
          onToggleConfig={toggleStartConfig}
          onToggleStartWithPixel={toggleStartWithPixel}
        />
      )}

      {promptPickerOpen && (
        <PromptTemplatePickerModal
          activeProject={activeProject}
          canSend={promptSendStatus.canSend}
          renderContext={{
            projectName: activeProject?.name ?? '',
            projectPath: promptProjectPath
          }}
          sendStatusMessage={promptSendStatus.message}
          templates={promptTemplates}
          onClose={() => setPromptPickerOpen(false)}
          onSendPrompt={sendPromptToActiveTerminal}
        />
      )}

      {projectForm && (
        <ProjectFormModal
          form={projectForm}
          onChange={setProjectForm}
          onClose={() => setProjectForm(null)}
          onSave={saveProjectForm}
        />
      )}

      {terminalForm && (
        <TerminalFormModal
          form={terminalForm}
          onChange={setTerminalForm}
          onClose={() => setTerminalForm(null)}
          onDelete={() => {
            if (!terminalForm.id) return
            deleteTerminalConfig(terminalForm.id)
            setTerminalForm(null)
          }}
          onPickFolder={pickTerminalFolder}
          onSave={saveTerminalForm}
        />
      )}
    </main>
  )
}

export default App
