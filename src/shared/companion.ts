export const COMPANION_CHANNELS = {
  loadBridgeState: 'companion:load-bridge-state'
} as const

export type CompanionCliState = 'idle' | 'working' | 'done' | 'error' | 'waiting_input'

export type CompanionBridgeMessage = {
  id: string
  createdAt: string
  cliState: CompanionCliState
  title: string
  summary: string
  agentName?: string
  details?: string
  projectColor?: string
  projectName?: string
  sessionName?: string
  source: 'app' | 'mcp'
}

export type CompanionBridgeState = {
  currentState: CompanionCliState
  messages: CompanionBridgeMessage[]
  updatedAt?: string
}

export type CompanionBridgeApi = {
  loadBridgeState: () => Promise<CompanionBridgeState>
}
