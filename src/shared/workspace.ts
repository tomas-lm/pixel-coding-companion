export const WORKSPACE_CHANNELS = {
  pickFolder: 'workspace:pick-folder',
  loadConfig: 'workspace:load-config',
  saveConfig: 'workspace:save-config'
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

export type RunningSessionStatus = 'starting' | 'running' | 'exited' | 'error'

export type RunningSession = {
  id: string
  projectId: string
  configId: string
  name: string
  kind: SessionKind
  cwd: string
  commands: string[]
  status: RunningSessionStatus
  metadata: string
}

export type WorkspaceConfig = {
  projects: Project[]
  terminalConfigs: TerminalConfig[]
  activeProjectId?: string
}

export type FolderPickResult = {
  name: string
  path: string
} | null

export type WorkspaceApi = {
  pickFolder: () => Promise<FolderPickResult>
  loadConfig: () => Promise<WorkspaceConfig | null>
  saveConfig: (config: WorkspaceConfig) => Promise<void>
}
