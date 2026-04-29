export const WORKSPACE_CHANNELS = {
  pickFolder: 'workspace:pick-folder',
  loadConfig: 'workspace:load-config',
  saveConfig: 'workspace:save-config'
} as const

export const VIEW_CHANNELS = {
  resetLayout: 'view:reset-layout'
} as const

export type SessionKind = 'ai' | 'shell' | 'dev_server' | 'logs' | 'test' | 'custom'

export type Project = {
  id: string
  name: string
  color: string
  description: string
}

export type TerminalConfig = {
  id: string
  projectId: string
  name: string
  kind: SessionKind
  cwd: string
  commands: string[]
}

export type RunningSessionStatus = 'starting' | 'running' | 'done' | 'error'

export type RunningSession = {
  id: string
  projectId: string
  configId: string
  name: string
  projectColor: string
  projectName: string
  kind: SessionKind
  cwd: string
  commands: string[]
  status: RunningSessionStatus
  metadata: string
  startedAt: string
  endedAt?: string
  exitCode?: number
  exitSignal?: number
  durationMs?: number
  lastActivityAt?: string
  lastOutputPreview?: string
}

export type WorkspaceConfig = {
  projects: Project[]
  terminalConfigs: TerminalConfig[]
  activeProjectId?: string
  layout?: WorkspaceLayout
}

export type FolderPickResult = {
  name: string
  path: string
} | null

export type WorkspaceLayout = {
  railWidth: number
  companionWidth: number
  projectsHeight: number
  terminalsHeight: number
}

export type WorkspaceApi = {
  pickFolder: () => Promise<FolderPickResult>
  loadConfig: () => Promise<WorkspaceConfig | null>
  saveConfig: (config: WorkspaceConfig) => Promise<void>
}

export type ViewApi = {
  onResetLayout: (callback: () => void) => () => void
}
