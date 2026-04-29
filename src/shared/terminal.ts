import type { WorkspaceApi } from './workspace'

export const TERMINAL_CHANNELS = {
  start: 'terminal:start',
  stop: 'terminal:stop',
  input: 'terminal:input',
  resize: 'terminal:resize',
  data: 'terminal:data',
  exit: 'terminal:exit'
} as const

export type TerminalSessionId = string

export type TerminalStartRequest = {
  id: TerminalSessionId
  cols: number
  rows: number
  cwd?: string
  commands?: string[]
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

export type Unsubscribe = () => void

export type TerminalApi = {
  start: (request: TerminalStartRequest) => Promise<TerminalStartResponse>
  stop: (id: TerminalSessionId) => Promise<void>
  write: (request: TerminalInputRequest) => void
  resize: (request: TerminalResizeRequest) => void
  onData: (callback: (event: TerminalDataEvent) => void) => Unsubscribe
  onExit: (callback: (event: TerminalExitEvent) => void) => Unsubscribe
}

export type CompanionApi = {
  terminal: TerminalApi
  workspace: WorkspaceApi
}
