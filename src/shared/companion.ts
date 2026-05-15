import type {
  CompanionBoxOpenRequest,
  CompanionBoxOpenResult,
  CompanionSelectRequest,
  CompanionSelectResult,
  CompanionStarterSelectRequest,
  CompanionStarterSelectResult,
  CompanionStoreState
} from './companionStore'

export const COMPANION_CHANNELS = {
  loadBridgeState: 'companion:load-bridge-state',
  loadProgress: 'companion:load-progress',
  loadStoreState: 'companion:load-store-state',
  openBox: 'companion:open-box',
  selectCompanion: 'companion:select-companion',
  selectStarter: 'companion:select-starter'
} as const

export type CompanionCliState = 'idle' | 'working' | 'done' | 'error' | 'waiting_input'
export type CompanionEventType =
  | 'started'
  | 'finished'
  | 'blocked'
  | 'failed'
  | 'needs_input'
  | 'note'

export type CompanionBridgeMessage = {
  id: string
  createdAt: string
  cliState: CompanionCliState
  companionId?: string
  companionName?: string
  eventType?: CompanionEventType
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
  terminalColor?: string
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
  monsterPoints: number
  name: string
  progressRatio: number
  totalXp: number
  updatedAt?: string
  xpForNextLevel: number
}

export type CompanionBridgeApi = {
  loadBridgeState: () => Promise<CompanionBridgeState>
  loadProgress: () => Promise<CompanionProgressState>
  loadStoreState: () => Promise<CompanionStoreState>
  openBox: (request: CompanionBoxOpenRequest) => Promise<CompanionBoxOpenResult>
  selectCompanion: (request: CompanionSelectRequest) => Promise<CompanionSelectResult>
  selectStarter: (request: CompanionStarterSelectRequest) => Promise<CompanionStarterSelectResult>
}
