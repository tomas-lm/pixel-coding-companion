import { useCallback, useState, type CSSProperties } from 'react'
import type { CompanionBridgeMessage } from '../../shared/companion'
import type { VaultConfig, VaultMarkdownFile } from '../../shared/vault'
import type {
  PixelLauncherAgentId,
  Project,
  PromptTemplate,
  ResolvedPixelLauncherAgentId,
  RunningSession,
  TerminalConfig,
  WorkspaceCodeEditorSettings,
  WorkspaceFeatureSettings
} from '../../shared/workspace'
import { DEFAULT_PIXEL_LAUNCHER_FALLBACK_AGENT_ID } from '../../shared/workspace'
import {
  ActivitySidebar,
  type ActivitySidebarItem,
  type ActivitySidebarItemId
} from './components/ActivitySidebar'
import { CompanionCatalogPanel } from './components/CompanionCatalogPanel'
import { CompanionPanel } from './components/CompanionPanel'
import { ConfigsPanel } from './components/ConfigsPanel'
import { LoadingScreen } from './components/LoadingScreen'
import { OnboardingFlow, type OnboardingResult } from './components/OnboardingFlow'
import { ProjectFormModal } from './components/ProjectFormModal'
import { PromptTemplatePickerModal } from './components/PromptTemplatePickerModal'
import { PromptTemplatesPanel } from './components/PromptTemplatesPanel'
import { StarterSelectionPage } from './components/StarterSelectionPage'
import { StartWorkspaceModal } from './components/StartWorkspaceModal'
import { TerminalFormModal } from './components/TerminalFormModal'
import { TerminalWorkspacePanel } from './components/TerminalWorkspacePanel'
import { VaultRail } from './components/VaultRail'
import { VaultWorkspacePanel } from './components/VaultWorkspacePanel'
import { WorkspaceRail } from './components/WorkspaceRail'
import {
  COMPANION_REGISTRY,
  STARTER_COMPANION_ID,
  STARTER_COMPANION_IDS,
  getCompanionStageForLevel
} from './companions/companionRegistry'
import { getActiveCompanionProgress, getCompanionMessageColor } from './app/companionSelectors'
import { primeCompletionSound } from './app/notificationSounds'
import { getPromptTemplateProjectPath, getPromptTemplateSendStatus } from './app/promptTemplates'
import type { ProjectForm } from './app/projectForms'
import { reorderItemsByTargetIndex } from './app/listOrdering'
import {
  normalizeWorkspaceFolderPath,
  resolvePickFolderDefaultPath,
  workspaceDefaultFolderValidationMessage
} from './app/workspacePaths'
import { createRunningSession, findReusableSessionForConfig } from './app/runningSessions'
import {
  commandsFromText,
  commandsToText,
  getCompanionMessage,
  getLiveConfigIds,
  getOutputPreview,
  getTimeMs,
  isLiveSession
} from './app/sessionDisplay'
import { createEmptyTerminalForm, type TerminalForm } from './app/terminalForms'
import { updateVaultLastOpenedFile } from './app/vaults'
import { useCompanionBridge } from './hooks/useCompanionBridge'
import { useCompletionNotificationSound } from './hooks/useCompletionNotificationSound'
import { useTerminalEvents } from './hooks/useTerminalEvents'
import { useTerminalHoverCard } from './hooks/useTerminalHoverCard'
import { useWorkspaceConfig } from './hooks/useWorkspaceConfig'
import { useWorkspaceLayout } from './hooks/useWorkspaceLayout'

const COMPANION_NAME = 'Ghou'
const PROJECT_COLORS = ['#4ea1ff', '#ef5b5b', '#f7d56f', '#7fe7dc', '#c084fc', '#34d399']
const MARKDOWN_ARTIFACT_PATTERN = /\.(?:md|markdown)$/i
const CODEX_START_COMMAND_PATTERN =
  /^(?:codex|pixel\s+codex|node\s+.+pixel\.mjs['"]?\s+codex)(?:\s|$)/
const CLAUDE_START_COMMAND_PATTERN =
  /^(?:claude|pixel\s+claude|node\s+.+pixel\.mjs['"]?\s+claude)(?:\s|$)/
type StartWorkspaceSelection = {
  pixelAgent: PixelLauncherAgentId
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

function normalizeLocalPath(pathText: string): string {
  return pathText.replace(/\\/g, '/').replace(/\/+$/g, '')
}

function isPathInsideRoot(rootPath: string, filePath: string): boolean {
  const normalizedRoot = normalizeLocalPath(rootPath)
  const normalizedFilePath = normalizeLocalPath(filePath)

  return (
    normalizedFilePath === normalizedRoot || normalizedFilePath.startsWith(`${normalizedRoot}/`)
  )
}

function detectPixelLauncherAgent(command: string): ResolvedPixelLauncherAgentId | null {
  const trimmedCommand = command.trim()

  if (CLAUDE_START_COMMAND_PATTERN.test(trimmedCommand)) return 'claude'
  if (CODEX_START_COMMAND_PATTERN.test(trimmedCommand)) return 'codex'

  return null
}

function isPixelAgentCommand(command: string, pixelAgent: PixelLauncherAgentId): boolean {
  const detectedAgent = detectPixelLauncherAgent(command)

  if (pixelAgent === 'auto') return detectedAgent !== null
  return detectedAgent === pixelAgent
}

function detectConfigPixelAgent(config: TerminalConfig): ResolvedPixelLauncherAgentId | null {
  if (config.kind !== 'ai') return null

  for (const command of config.commands) {
    const detectedAgent = detectPixelLauncherAgent(command)
    if (detectedAgent) return detectedAgent
  }

  return null
}

function supportsPixelAgent(config: TerminalConfig, pixelAgent: PixelLauncherAgentId): boolean {
  return (
    config.kind === 'ai' &&
    config.commands.some((command) => isPixelAgentCommand(command, pixelAgent))
  )
}

function getSupportedPixelAgent(
  config: TerminalConfig,
  preferredAgent: PixelLauncherAgentId
): PixelLauncherAgentId {
  if (preferredAgent === 'auto') {
    return supportsPixelAgent(config, 'auto') ? 'auto' : DEFAULT_PIXEL_LAUNCHER_FALLBACK_AGENT_ID
  }
  if (supportsPixelAgent(config, preferredAgent)) return preferredAgent

  const detectedAgent = detectConfigPixelAgent(config)
  if (detectedAgent) return detectedAgent

  return preferredAgent
}

function App(): React.JSX.Element {
  const [runningSessions, setRunningSessions] = useState<RunningSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [projectForm, setProjectForm] = useState<ProjectForm | null>(null)
  const [projectFormError, setProjectFormError] = useState<string | null>(null)
  const [terminalForm, setTerminalForm] = useState<TerminalForm | null>(null)
  const [startSelection, setStartSelection] = useState<StartWorkspaceSelection | null>(null)
  const { applyTerminalTheme, layout, setLayout, startLayoutResize, terminalThemeId } =
    useWorkspaceLayout()
  const {
    activeProjectId,
    activeVaultId,
    codeEditorSettings,
    configLoaded,
    featureSettings,
    pixelLauncherSettings,
    promptTemplates,
    projects,
    setActiveProjectId,
    setActiveVaultId,
    setCodeEditorSettings,
    setFeatureSettings,
    setPixelLauncherSettings,
    setPromptTemplates,
    setProjects,
    setTerminalConfigs,
    setVaults,
    terminalConfigs,
    vaults
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
  const [selectedVaultFileSelection, setSelectedVaultFileSelection] = useState<{
    path: string
    vaultId: string
  } | null>(null)
  const [vaultHasUnsavedChanges, setVaultHasUnsavedChanges] = useState(false)
  const [vaultRefreshKey, setVaultRefreshKey] = useState(0)

  useCompletionNotificationSound(
    companionBridgeState.messages,
    featureSettings.playSoundsUponFinishing
  )

  const changeFeatureSettings = useCallback(
    (nextFeatureSettings: WorkspaceFeatureSettings): void => {
      if (nextFeatureSettings.playSoundsUponFinishing) {
        primeCompletionSound()
      }

      setFeatureSettings(nextFeatureSettings)
    },
    [setFeatureSettings]
  )

  const changeCodeEditorSettings = useCallback(
    (nextCodeEditorSettings: WorkspaceCodeEditorSettings): void => {
      setCodeEditorSettings(nextCodeEditorSettings)
    },
    [setCodeEditorSettings]
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
    (config) =>
      Boolean(startSelection?.startWithPixel) &&
      Boolean(startSelection && supportsPixelAgent(config, startSelection.pixelAgent))
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
    },
    {
      icon: 'vaults',
      id: 'vaults',
      label: 'Vaults'
    },
    {
      icon: 'configs',
      id: 'configs',
      label: 'Configs'
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
  const activeVault = vaults.find((vault) => vault.id === activeVaultId) ?? null
  const selectedVaultFilePath =
    activeVault && selectedVaultFileSelection?.vaultId === activeVault.id
      ? selectedVaultFileSelection.path
      : (activeVault?.lastOpenedFilePath ?? null)

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

  const reorderProjects = useCallback(
    (draggedProjectId: string, targetIndex: number): void => {
      setProjects((currentProjects) =>
        reorderItemsByTargetIndex(currentProjects, draggedProjectId, targetIndex)
      )
    },
    [setProjects]
  )

  const reorderTerminalConfigs = useCallback(
    (draggedConfigId: string, targetIndex: number): void => {
      if (!activeProjectId) return

      setTerminalConfigs((currentConfigs) => {
        const activeConfigs = currentConfigs.filter(
          (config) => config.projectId === activeProjectId
        )
        const reorderedActiveConfigs = reorderItemsByTargetIndex(
          activeConfigs,
          draggedConfigId,
          targetIndex
        )

        if (reorderedActiveConfigs === activeConfigs) {
          return currentConfigs
        }

        let reorderedIndex = 0
        return currentConfigs.map((config) =>
          config.projectId === activeProjectId ? reorderedActiveConfigs[reorderedIndex++] : config
        )
      })
    },
    [activeProjectId, setTerminalConfigs]
  )

  const reorderRunningSessions = useCallback(
    (draggedSessionId: string, targetIndex: number): void => {
      if (!activeProjectId) return

      setRunningSessions((currentSessions) => {
        const activeSessions = currentSessions.filter(
          (session) => session.projectId === activeProjectId
        )
        const reorderedActiveSessions = reorderItemsByTargetIndex(
          activeSessions,
          draggedSessionId,
          targetIndex
        )

        if (reorderedActiveSessions === activeSessions) {
          return currentSessions
        }

        let reorderedIndex = 0
        return currentSessions.map((session) =>
          session.projectId === activeProjectId
            ? reorderedActiveSessions[reorderedIndex++]
            : session
        )
      })
    },
    [activeProjectId]
  )

  const startConfig = (config: TerminalConfig): void => {
    const existingSession = findReusableSessionForConfig(config, runningSessions)

    if (existingSession) {
      setActiveProjectId(existingSession.projectId)
      setActiveSessionId(existingSession.id)
      return
    }

    const project = projects.find((candidate) => candidate.id === config.projectId) ?? null
    const pixelAgent = getSupportedPixelAgent(config, pixelLauncherSettings.preferredAgent)
    const session = createRunningSession(config, project, {
      fallbackProjectColor: PROJECT_COLORS[0],
      pixelAgent,
      useStartWithPixel: supportsPixelAgent(config, pixelAgent)
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
      pixelAgent: pixelLauncherSettings.preferredAgent,
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

  const changeStartPixelAgent = (pixelAgent: PixelLauncherAgentId): void => {
    setStartSelection((currentSelection) =>
      currentSelection
        ? {
            ...currentSelection,
            pixelAgent
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
          pixelAgent: startSelection.pixelAgent,
          useStartWithPixel:
            startSelection.startWithPixel && supportsPixelAgent(config, startSelection.pixelAgent)
        })
      })
    const firstExistingSession = runningSessions.find(
      (session) => session.projectId === startSelection.projectId && isLiveSession(session)
    )

    setStartSelection(null)
    if (startSelection.startWithPixel) {
      setPixelLauncherSettings({ preferredAgent: startSelection.pixelAgent })
    }

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
    setProjectFormError(null)
    setProjectForm({
      name: '',
      description: '',
      color: PROJECT_COLORS[projects.length % PROJECT_COLORS.length],
      defaultFolder: '',
      changeRoots: []
    })
  }

  const openEditProject = (project: Project): void => {
    setProjectFormError(null)
    setProjectForm({
      id: project.id,
      name: project.name,
      description: project.description,
      color: project.color,
      defaultFolder: normalizeWorkspaceFolderPath(project.defaultFolder ?? ''),
      changeRoots: project.changeRoots ?? []
    })
  }

  const saveProjectForm = (): void => {
    if (!projectForm?.name.trim()) return
    const normalizedDefaultFolder = normalizeWorkspaceFolderPath(projectForm.defaultFolder)
    const folderIssue = workspaceDefaultFolderValidationMessage(normalizedDefaultFolder)
    if (folderIssue) {
      setProjectFormError(folderIssue)
      return
    }
    setProjectFormError(null)

    if (projectForm.id) {
      setProjects((currentProjects) =>
        currentProjects.map((project) =>
          project.id === projectForm.id
            ? {
                ...project,
                name: projectForm.name.trim(),
                description: projectForm.description.trim(),
                color: projectForm.color,
                defaultFolder: normalizedDefaultFolder || undefined,
                changeRoots: projectForm.changeRoots
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
      color: projectForm.color,
      defaultFolder: normalizedDefaultFolder || undefined,
      changeRoots: projectForm.changeRoots
    }

    setProjects((currentProjects) => [...currentProjects, project])
    setActiveProjectId(project.id)
    setActiveSessionId(null)
    setProjectForm(null)
  }

  const openCreateTerminal = (): void => {
    if (!activeProject) return

    setTerminalForm(
      createEmptyTerminalForm(normalizeWorkspaceFolderPath(activeProject.defaultFolder ?? ''))
    )
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
    if (!activeProject || !terminalForm) return

    const defaultPath = resolvePickFolderDefaultPath(
      terminalForm.cwd,
      activeProject.defaultFolder ?? ''
    )
    const folder = await window.api.workspace.pickFolder(defaultPath ? { defaultPath } : undefined)
    if (!folder) return
    const path = normalizeWorkspaceFolderPath(folder.path)

    setTerminalForm((currentForm) =>
      currentForm
        ? {
            ...currentForm,
            cwd: path,
            name: currentForm.name || folder.name
          }
        : currentForm
    )
  }

  const pickProjectDefaultFolder = async (): Promise<void> => {
    if (!projectForm) return

    const defaultPath = resolvePickFolderDefaultPath(projectForm.defaultFolder)
    const folder = await window.api.workspace.pickFolder(defaultPath ? { defaultPath } : undefined)
    if (!folder) return
    const path = normalizeWorkspaceFolderPath(folder.path)

    setProjectForm((currentForm) =>
      currentForm
        ? {
            ...currentForm,
            defaultFolder: path
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
      cwd: normalizeWorkspaceFolderPath(terminalForm.cwd.trim()),
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

  const changeVaultDirtyState = useCallback((isDirty: boolean): void => {
    setVaultHasUnsavedChanges(isDirty)
  }, [])

  const confirmDiscardVaultChanges = (): boolean => {
    if (!vaultHasUnsavedChanges) return true

    return window.confirm('Discard unsaved changes in the current note?')
  }

  const saveVault = (vault: VaultConfig): void => {
    if (!confirmDiscardVaultChanges()) return

    setVaults((currentVaults) => {
      if (currentVaults.some((currentVault) => currentVault.id === vault.id)) {
        return currentVaults.map((currentVault) =>
          currentVault.id === vault.id ? vault : currentVault
        )
      }

      return [...currentVaults, vault]
    })
    setActiveVaultId(vault.id)
    setSelectedVaultFileSelection(
      vault.lastOpenedFilePath ? { path: vault.lastOpenedFilePath, vaultId: vault.id } : null
    )
    setVaultHasUnsavedChanges(false)
  }

  const deleteVault = (vaultId: string): void => {
    if (vaultId === activeVaultId && !confirmDiscardVaultChanges()) return
    if (!window.confirm('Remove this vault from Pixel? Files stay on disk.')) return

    const remainingVaults = vaults.filter((vault) => vault.id !== vaultId)
    setVaults(remainingVaults)

    if (vaultId === activeVaultId) {
      const nextVault = remainingVaults[0] ?? null
      setActiveVaultId(nextVault?.id ?? null)
      setSelectedVaultFileSelection(
        nextVault?.lastOpenedFilePath
          ? { path: nextVault.lastOpenedFilePath, vaultId: nextVault.id }
          : null
      )
      setVaultHasUnsavedChanges(false)
    }
  }

  const selectVault = (vaultId: string): void => {
    if (vaultId !== activeVaultId && !confirmDiscardVaultChanges()) return

    const nextVault = vaults.find((vault) => vault.id === vaultId) ?? null
    setActiveVaultId(nextVault?.id ?? null)
    setSelectedVaultFileSelection(
      nextVault?.lastOpenedFilePath
        ? { path: nextVault.lastOpenedFilePath, vaultId: nextVault.id }
        : null
    )
    setVaultHasUnsavedChanges(false)
  }

  const selectVaultFile = (filePath: string): void => {
    if (!activeVault) return
    if (filePath !== selectedVaultFilePath && !confirmDiscardVaultChanges()) return

    setSelectedVaultFileSelection({ path: filePath, vaultId: activeVault.id })
    setVaults((currentVaults) => updateVaultLastOpenedFile(currentVaults, activeVault.id, filePath))
    setVaultHasUnsavedChanges(false)
  }

  const openMarkdownArtifact = (filePath: string): void => {
    if (!MARKDOWN_ARTIFACT_PATTERN.test(filePath)) {
      void window.api.system.openTarget({
        editor: codeEditorSettings.preferredEditor,
        kind: 'file_path',
        path: filePath
      })
      return
    }

    const targetVault = vaults.find((vault) => isPathInsideRoot(vault.rootPath, filePath)) ?? null
    if (!targetVault) {
      void window.api.system.openTarget({
        editor: codeEditorSettings.preferredEditor,
        kind: 'file_path',
        path: filePath
      })
      return
    }

    const isDifferentOpenFile =
      targetVault.id !== activeVaultId || selectedVaultFilePath !== filePath
    if (isDifferentOpenFile && !confirmDiscardVaultChanges()) return

    setActiveVaultId(targetVault.id)
    setSelectedVaultFileSelection({ path: filePath, vaultId: targetVault.id })
    setVaults((currentVaults) => updateVaultLastOpenedFile(currentVaults, targetVault.id, filePath))
    setVaultHasUnsavedChanges(false)
    setActiveActivityItemId('vaults')
  }

  const createVaultNote = async (name: string): Promise<void> => {
    if (!activeVault) return
    if (!confirmDiscardVaultChanges()) return

    const file = await window.api.vault.createMarkdownFile({
      name,
      rootPath: activeVault.rootPath
    })
    setSelectedVaultFileSelection({ path: file.path, vaultId: activeVault.id })
    setVaults((currentVaults) =>
      updateVaultLastOpenedFile(currentVaults, activeVault.id, file.path)
    )
    setVaultRefreshKey((currentKey) => currentKey + 1)
    setVaultHasUnsavedChanges(false)
  }

  const handleVaultFileSaved = (file: VaultMarkdownFile): void => {
    if (!activeVault) return

    setVaults((currentVaults) =>
      updateVaultLastOpenedFile(currentVaults, activeVault.id, file.path)
    )
    setVaultRefreshKey((currentKey) => currentKey + 1)
    setVaultHasUnsavedChanges(false)
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
      codeEditorSettings,
      layout,
      featureSettings,
      pixelLauncherSettings,
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
  const selectedSessionId = activeSession?.id ?? null
  const promptSendStatus = getPromptTemplateSendStatus(activeSession)
  const promptProjectPath = getPromptTemplateProjectPath(activeSession, activeProjectConfigs)

  return (
    <main className="app-shell" style={activeStyle}>
      <ActivitySidebar
        activeItemId={activeActivityItemId}
        items={activitySidebarItems}
        onSelect={setActiveActivityItemId}
      />

      {activeActivityItemId === 'vaults' ? (
        <VaultRail
          activeVault={activeVault}
          activeVaultId={activeVaultId}
          selectedFilePath={selectedVaultFilePath}
          vaults={vaults}
          refreshKey={vaultRefreshKey}
          onCreateNote={createVaultNote}
          onDeleteVault={deleteVault}
          onSaveVault={saveVault}
          onSelectFile={selectVaultFile}
          onSelectVault={selectVault}
        />
      ) : (
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
          onResizePointerDown={startLayoutResize}
          onScheduleTerminalHoverCard={scheduleTerminalHoverCard}
          onSelectProject={selectProject}
          onSelectSession={setActiveSessionId}
          onReorderProjects={reorderProjects}
          onReorderRunning={reorderRunningSessions}
          onReorderTerminals={reorderTerminalConfigs}
          onStartConfig={startConfig}
          onStartWorkspace={openStartWorkspace}
          onStopSession={stopSession}
        />
      )}

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
          codeEditorSettings={codeEditorSettings}
          runningSessions={runningSessions}
          selectedSessionId={selectedSessionId}
          terminalThemeId={terminalThemeId}
          terminalTitle={terminalTitle}
          onCreateProject={openCreateProject}
          onCreateTerminal={openCreateTerminal}
          onOpenMarkdownArtifact={openMarkdownArtifact}
          onOpenPromptPicker={() => setPromptPickerOpen(true)}
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
      ) : activeActivityItemId === 'configs' ? (
        <ConfigsPanel
          codeEditorSettings={codeEditorSettings}
          featureSettings={featureSettings}
          onChangeCodeEditorSettings={changeCodeEditorSettings}
          onChangeFeatureSettings={changeFeatureSettings}
          onSelectTerminalTheme={applyTerminalTheme}
          terminalThemeId={terminalThemeId}
        />
      ) : activeActivityItemId === 'vaults' ? (
        <VaultWorkspacePanel
          activeVault={activeVault}
          selectedFilePath={selectedVaultFilePath}
          onCreateNote={createVaultNote}
          onDirtyChange={changeVaultDirtyState}
          onFileSaved={handleVaultFileSaved}
          onSelectFile={selectVaultFile}
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
          pixelAgent={startSelection.pixelAgent}
          project={startProject}
          selectedConfigIds={startSelection.selectedConfigIds}
          selectedCount={selectedStartConfigs.length}
          selectedPixelConfigCount={selectedStartPixelConfigs.length}
          selectedPixelLabel={selectedStartPixelLabel}
          startWithPixel={startSelection.startWithPixel}
          onChangePixelAgent={changeStartPixelAgent}
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
          defaultFolderError={projectFormError}
          form={projectForm}
          onChange={(nextForm) => {
            setProjectFormError(null)
            setProjectForm(nextForm)
          }}
          onClose={() => {
            setProjectFormError(null)
            setProjectForm(null)
          }}
          onPickDefaultFolder={pickProjectDefaultFolder}
          onPickChangeRoot={window.api.workspace.pickFolder}
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
