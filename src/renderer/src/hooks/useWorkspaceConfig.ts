import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import type {
  WorkspaceFeatureSettings,
  PromptTemplate,
  Project,
  TerminalConfig,
  TerminalThemeId,
  WorkspaceLayout
} from '../../../shared/workspace'
import { normalizeLayout } from '../app/layout'
import { normalizePromptTemplates } from '../app/promptTemplates'
import {
  DEFAULT_WORKSPACE_FEATURE_SETTINGS,
  normalizeWorkspaceFeatureSettings
} from '../app/workspaceFeatureSettings'

type UseWorkspaceConfigOptions = {
  applyTerminalTheme: (themeId?: unknown) => TerminalThemeId
  layout: WorkspaceLayout
  setLayout: Dispatch<SetStateAction<WorkspaceLayout>>
  terminalThemeId: TerminalThemeId
}

type UseWorkspaceConfigResult = {
  activeProjectId: string | null
  configLoaded: boolean
  featureSettings: WorkspaceFeatureSettings
  projects: Project[]
  promptTemplates: PromptTemplate[]
  setActiveProjectId: Dispatch<SetStateAction<string | null>>
  setFeatureSettings: Dispatch<SetStateAction<WorkspaceFeatureSettings>>
  setPromptTemplates: Dispatch<SetStateAction<PromptTemplate[]>>
  setProjects: Dispatch<SetStateAction<Project[]>>
  setTerminalConfigs: Dispatch<SetStateAction<TerminalConfig[]>>
  terminalConfigs: TerminalConfig[]
}

export function useWorkspaceConfig({
  applyTerminalTheme,
  layout,
  setLayout,
  terminalThemeId
}: UseWorkspaceConfigOptions): UseWorkspaceConfigResult {
  const [projects, setProjects] = useState<Project[]>([])
  const [terminalConfigs, setTerminalConfigs] = useState<TerminalConfig[]>([])
  const [promptTemplates, setPromptTemplates] = useState<PromptTemplate[]>([])
  const [featureSettings, setFeatureSettings] = useState<WorkspaceFeatureSettings>(
    DEFAULT_WORKSPACE_FEATURE_SETTINGS
  )
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const [configLoaded, setConfigLoaded] = useState(false)

  useEffect(() => {
    let mounted = true

    window.api.workspace
      .loadConfig()
      .then((config) => {
        if (!mounted) return

        if (config) {
          setProjects(config.projects)
          setTerminalConfigs(config.terminalConfigs)
          setPromptTemplates(normalizePromptTemplates(config.promptTemplates))
          setFeatureSettings(normalizeWorkspaceFeatureSettings(config.featureSettings))
          setActiveProjectId(
            config.projects.find((project) => project.id === config.activeProjectId)?.id ??
              config.projects[0]?.id ??
              null
          )
          setLayout(normalizeLayout(config.layout))
          applyTerminalTheme(config.terminalThemeId)
        }
      })
      .finally(() => {
        if (mounted) setConfigLoaded(true)
      })

    return () => {
      mounted = false
    }
  }, [applyTerminalTheme, setLayout])

  useEffect(() => {
    if (!configLoaded) return

    const saveTimer = window.setTimeout(() => {
      void window.api.workspace.saveConfig({
        projects,
        terminalConfigs,
        activeProjectId: activeProjectId ?? undefined,
        featureSettings,
        layout,
        promptTemplates,
        terminalThemeId
      })
    }, 180)

    return () => window.clearTimeout(saveTimer)
  }, [
    activeProjectId,
    configLoaded,
    featureSettings,
    layout,
    projects,
    promptTemplates,
    terminalConfigs,
    terminalThemeId
  ])

  return {
    activeProjectId,
    featureSettings,
    configLoaded,
    promptTemplates,
    projects,
    setActiveProjectId,
    setFeatureSettings,
    setPromptTemplates,
    setProjects,
    setTerminalConfigs,
    terminalConfigs
  }
}
