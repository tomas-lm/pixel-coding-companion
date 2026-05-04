import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import type {
  PromptTemplate,
  Project,
  TerminalConfig,
  TerminalThemeId,
  WorkspaceLayout
} from '../../../shared/workspace'
import { normalizeLayout } from '../app/layout'
import { DEFAULT_PROMPT_TEMPLATES } from '../app/promptTemplates'

type UseWorkspaceConfigOptions = {
  applyTerminalTheme: (themeId?: unknown) => TerminalThemeId
  layout: WorkspaceLayout
  setLayout: Dispatch<SetStateAction<WorkspaceLayout>>
  terminalThemeId: TerminalThemeId
}

type UseWorkspaceConfigResult = {
  activeProjectId: string | null
  configLoaded: boolean
  projects: Project[]
  promptTemplates: PromptTemplate[]
  setActiveProjectId: Dispatch<SetStateAction<string | null>>
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
  const [promptTemplates, setPromptTemplates] = useState<PromptTemplate[]>(DEFAULT_PROMPT_TEMPLATES)
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
          setPromptTemplates(config.promptTemplates ?? DEFAULT_PROMPT_TEMPLATES)
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
        layout,
        promptTemplates,
        terminalThemeId
      })
    }, 180)

    return () => window.clearTimeout(saveTimer)
  }, [
    activeProjectId,
    configLoaded,
    layout,
    projects,
    promptTemplates,
    terminalConfigs,
    terminalThemeId
  ])

  return {
    activeProjectId,
    configLoaded,
    promptTemplates,
    projects,
    setActiveProjectId,
    setPromptTemplates,
    setProjects,
    setTerminalConfigs,
    terminalConfigs
  }
}
