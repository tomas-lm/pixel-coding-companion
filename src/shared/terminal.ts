import type { CompanionBridgeApi } from './companion'
import type { SystemApi } from './system'
import type { ViewApi, WorkspaceApi } from './workspace'

export const TERMINAL_CHANNELS = {
  start: 'terminal:start',
  stop: 'terminal:stop',
  input: 'terminal:input',
  resize: 'terminal:resize',
  data: 'terminal:data',
  exit: 'terminal:exit',
  commandExit: 'terminal:command-exit'
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

export type Unsubscribe = () => void

export type TerminalApi = {
  start: (request: TerminalStartRequest) => Promise<TerminalStartResponse>
  stop: (id: TerminalSessionId) => Promise<void>
  write: (request: TerminalInputRequest) => void
  resize: (request: TerminalResizeRequest) => void
  onData: (callback: (event: TerminalDataEvent) => void) => Unsubscribe
  onExit: (callback: (event: TerminalExitEvent) => void) => Unsubscribe
  onCommandExit: (callback: (event: TerminalCommandExitEvent) => void) => Unsubscribe
}

export type CompanionApi = {
  companion: CompanionBridgeApi
  system: SystemApi
  terminal: TerminalApi
  workspace: WorkspaceApi
  view: ViewApi
}
