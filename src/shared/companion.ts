export const COMPANION_CHANNELS = {
  loadBridgeState: 'companion:load-bridge-state',
  loadProgress: 'companion:load-progress'
} as const

export type CompanionCliState = 'idle' | 'working' | 'done' | 'error' | 'waiting_input'

export type CompanionBridgeMessage = {
  id: string
  createdAt: string
  cliState: CompanionCliState
  title: string
  summary: string
  agentName?: string
  contextSource?: string
  cwd?: string
  details?: string
  projectId?: string
  projectColor?: string
  projectName?: string
  sessionName?: string
  terminalId?: string
  terminalSessionId?: string
  source: 'app' | 'mcp'
}

export type CompanionBridgeState = {
  currentState: CompanionCliState
  messages: CompanionBridgeMessage[]
  updatedAt?: string
}

export type CompanionProgressState = {
  currentXp: number
  level: number
  maxLevel: number
  name: string
  progressRatio: number
  totalXp: number
  updatedAt?: string
  xpForNextLevel: number
}

export type CompanionBridgeApi = {
  loadBridgeState: () => Promise<CompanionBridgeState>
  loadProgress: () => Promise<CompanionProgressState>
}
