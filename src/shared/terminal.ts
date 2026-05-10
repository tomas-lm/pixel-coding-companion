import type { CompanionBridgeApi } from './companion'
import type { ClipboardApi, SystemApi } from './system'
import type { VaultApi } from './vault'
import type { PixelLauncherAgentId, ViewApi, WorkspaceApi } from './workspace'

export const TERMINAL_CHANNELS = {
  start: 'terminal:start',
  stop: 'terminal:stop',
  input: 'terminal:input',
  resize: 'terminal:resize',
  data: 'terminal:data',
  exit: 'terminal:exit',
  commandExit: 'terminal:command-exit',
  context: 'terminal:context'
} as const

export type TerminalSessionId = string

export type TerminalStartRequest = {
  id: TerminalSessionId
  autoLaunchInput?: string
  cols: number
  rows: number
  companionContext?: TerminalCompanionContext
  cwd?: string
  commands?: string[]
  env?: Record<string, string>
  pixelAgent?: PixelLauncherAgentId
  startWithPixel?: boolean
  suppressCommandExitMarker?: boolean
}

export type TerminalCompanionContext = {
  cwd?: string
  projectColor: string
  projectId: string
  projectName: string
  sessionId: TerminalSessionId
  terminalId: string
  terminalName: string
}

export type TerminalStartResponse = {
  id: TerminalSessionId
  pid: number
  shell: string
  cwd: string
  attached: boolean
  initialBuffer?: string
}

export type TerminalInputRequest = {
  id: TerminalSessionId
  data: string
}

export type TerminalResizeRequest = {
  id: TerminalSessionId
  cols: number
  rows: number
}

export type TerminalDataEvent = {
  id: TerminalSessionId
  data: string
}

export type TerminalExitEvent = {
  id: TerminalSessionId
  exitCode: number
  signal?: number
}

export type TerminalCommandExitEvent = {
  id: TerminalSessionId
  exitCode: number
}

export type TerminalContextHudStatus = 'unknown' | 'flow' | 'filling' | 'compact_soon' | 'danger'

export type TerminalContextHudSnapshot = {
  agent: 'codex'
  contextUsedPercent: number | null
  model: string | null
  reasoningEffort: string | null
  status: TerminalContextHudStatus
  terminalSessionId: TerminalSessionId
  updatedAt: string | null
}

export type TerminalContextEvent = {
  id: TerminalSessionId
  snapshot: TerminalContextHudSnapshot | null
}

export type Unsubscribe = () => void

export type TerminalApi = {
  start: (request: TerminalStartRequest) => Promise<TerminalStartResponse>
  stop: (id: TerminalSessionId) => Promise<void>
  write: (request: TerminalInputRequest) => void
  resize: (request: TerminalResizeRequest) => void
  onData: (callback: (event: TerminalDataEvent) => void) => Unsubscribe
  onExit: (callback: (event: TerminalExitEvent) => void) => Unsubscribe
  onCommandExit: (callback: (event: TerminalCommandExitEvent) => void) => Unsubscribe
  onContext: (callback: (event: TerminalContextEvent) => void) => Unsubscribe
}

export type CompanionApi = {
  companion: CompanionBridgeApi
  clipboard: ClipboardApi
  system: SystemApi
  terminal: TerminalApi
  vault: VaultApi
  workspace: WorkspaceApi
  view: ViewApi
}
