export const WORKSPACE_CHANNELS = {
  pickFolder: 'workspace:pick-folder'
} as const

export type SessionKind = 'ai' | 'shell' | 'dev_server' | 'logs' | 'test' | 'custom'

export type Project = {
  id: string
  name: string
  color: string
  description: string
}

export type SessionTemplate = {
  id: string
  projectId: string
  name: string
  kind: SessionKind
  command: string
  cwd: string
}

export type RunningSessionStatus = 'starting' | 'running' | 'exited' | 'error'

export type RunningSession = {
  id: string
  projectId: string
  templateId: string
  name: string
  kind: SessionKind
  command: string
  cwd: string
  status: RunningSessionStatus
  metadata: string
}

export type FolderPickResult = {
  name: string
  path: string
} | null

export type WorkspaceApi = {
  pickFolder: () => Promise<FolderPickResult>
}
