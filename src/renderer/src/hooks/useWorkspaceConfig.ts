import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import type {
  WorkspaceCodeEditorSettings,
  WorkspaceFeatureSettings,
  WorkspacePixelLauncherSettings,
  PromptTemplate,
  Project,
  TerminalConfig,
  TerminalThemeId,
  WorkspaceLayout
} from '../../../shared/workspace'
import type { VaultConfig } from '../../../shared/vault'
import { normalizeLayout } from '../app/layout'
import { normalizePromptTemplates } from '../app/promptTemplates'
import { normalizeProjects } from '../app/projects'
import { normalizeVaults } from '../app/vaults'
import {
  DEFAULT_WORKSPACE_CODE_EDITOR_SETTINGS,
  normalizeWorkspaceCodeEditorSettings
} from '../app/workspaceCodeEditorSettings'
import {
  DEFAULT_WORKSPACE_FEATURE_SETTINGS,
  normalizeWorkspaceFeatureSettings
} from '../app/workspaceFeatureSettings'
import {
  DEFAULT_WORKSPACE_PIXEL_LAUNCHER_SETTINGS,
  normalizeWorkspacePixelLauncherSettings
} from '../app/workspacePixelLauncherSettings'

type UseWorkspaceConfigOptions = {
  applyTerminalTheme: (themeId?: unknown) => TerminalThemeId
  layout: WorkspaceLayout
  setLayout: Dispatch<SetStateAction<WorkspaceLayout>>
  terminalThemeId: TerminalThemeId
}

type UseWorkspaceConfigResult = {
  activeProjectId: string | null
  activeVaultId: string | null
  codeEditorSettings: WorkspaceCodeEditorSettings
  configLoaded: boolean
  featureSettings: WorkspaceFeatureSettings
  pixelLauncherSettings: WorkspacePixelLauncherSettings
  projects: Project[]
  promptTemplates: PromptTemplate[]
  setActiveProjectId: Dispatch<SetStateAction<string | null>>
  setActiveVaultId: Dispatch<SetStateAction<string | null>>
  setCodeEditorSettings: Dispatch<SetStateAction<WorkspaceCodeEditorSettings>>
  setFeatureSettings: Dispatch<SetStateAction<WorkspaceFeatureSettings>>
  setPixelLauncherSettings: Dispatch<SetStateAction<WorkspacePixelLauncherSettings>>
  setPromptTemplates: Dispatch<SetStateAction<PromptTemplate[]>>
  setProjects: Dispatch<SetStateAction<Project[]>>
  setTerminalConfigs: Dispatch<SetStateAction<TerminalConfig[]>>
  setVaults: Dispatch<SetStateAction<VaultConfig[]>>
  terminalConfigs: TerminalConfig[]
  vaults: VaultConfig[]
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
  const [vaults, setVaults] = useState<VaultConfig[]>([])
  const [featureSettings, setFeatureSettings] = useState<WorkspaceFeatureSettings>(
    DEFAULT_WORKSPACE_FEATURE_SETTINGS
  )
  const [codeEditorSettings, setCodeEditorSettings] = useState<WorkspaceCodeEditorSettings>(
    DEFAULT_WORKSPACE_CODE_EDITOR_SETTINGS
  )
  const [pixelLauncherSettings, setPixelLauncherSettings] =
    useState<WorkspacePixelLauncherSettings>(DEFAULT_WORKSPACE_PIXEL_LAUNCHER_SETTINGS)
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const [activeVaultId, setActiveVaultId] = useState<string | null>(null)
  const [configLoaded, setConfigLoaded] = useState(false)

  useEffect(() => {
    let mounted = true

    window.api.workspace
      .loadConfig()
      .then((config) => {
        if (!mounted) return

        if (config) {
          const normalizedProjects = normalizeProjects(config.projects)
          setProjects(normalizedProjects)
          setTerminalConfigs(config.terminalConfigs)
          setPromptTemplates(normalizePromptTemplates(config.promptTemplates))
          const normalizedVaults = normalizeVaults(config.vaults)
          setVaults(normalizedVaults)
          setFeatureSettings(normalizeWorkspaceFeatureSettings(config.featureSettings))
          setCodeEditorSettings(normalizeWorkspaceCodeEditorSettings(config.codeEditorSettings))
          setPixelLauncherSettings(
            normalizeWorkspacePixelLauncherSettings(config.pixelLauncherSettings)
          )
          setActiveProjectId(
            normalizedProjects.find((project) => project.id === config.activeProjectId)?.id ??
              normalizedProjects[0]?.id ??
              null
          )
          setActiveVaultId(
            normalizedVaults.find((vault) => vault.id === config.activeVaultId)?.id ??
              normalizedVaults[0]?.id ??
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
        activeVaultId: activeVaultId ?? undefined,
        codeEditorSettings,
        featureSettings,
        layout,
        pixelLauncherSettings,
        promptTemplates,
        terminalThemeId,
        vaults
      })
    }, 180)

    return () => window.clearTimeout(saveTimer)
  }, [
    activeProjectId,
    activeVaultId,
    codeEditorSettings,
    configLoaded,
    featureSettings,
    layout,
    pixelLauncherSettings,
    projects,
    promptTemplates,
    terminalConfigs,
    terminalThemeId,
    vaults
  ])

  return {
    activeProjectId,
    activeVaultId,
    codeEditorSettings,
    featureSettings,
    pixelLauncherSettings,
    configLoaded,
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
  }
}
