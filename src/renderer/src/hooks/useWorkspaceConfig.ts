import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import type {
  Project,
  TerminalConfig,
  TerminalThemeId,
  WorkspaceLayout
} from '../../../shared/workspace'
import { normalizeLayout } from '../app/layout'

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
  setActiveProjectId: Dispatch<SetStateAction<string | null>>
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
        terminalThemeId
      })
    }, 180)

    return () => window.clearTimeout(saveTimer)
  }, [activeProjectId, configLoaded, layout, projects, terminalConfigs, terminalThemeId])

  return {
    activeProjectId,
    configLoaded,
    projects,
    setActiveProjectId,
    setProjects,
    setTerminalConfigs,
    terminalConfigs
  }
}
