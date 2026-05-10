import type { CodeEditorId } from './system'
import type { VaultConfig } from './vault'

export const WORKSPACE_CHANNELS = {
  pickFolder: 'workspace:pick-folder',
  loadConfig: 'workspace:load-config',
  saveConfig: 'workspace:save-config'
} as const

export const VIEW_CHANNELS = {
  resetLayout: 'view:reset-layout'
} as const

export const TERMINAL_THEME_OPTIONS = [
  { id: 'catppuccin_mocha', label: 'Catppuccin Mocha' },
  { id: 'one_dark_pro', label: 'One Dark Pro' },
  { id: 'tokyo_night', label: 'Tokyo Night' },
  { id: 'github_dark', label: 'GitHub Dark' },
  { id: 'dracula', label: 'Dracula' },
  { id: 'pixel_classic', label: 'Pixel Classic' }
] as const

export type TerminalThemeId = (typeof TERMINAL_THEME_OPTIONS)[number]['id']

export const DEFAULT_TERMINAL_THEME_ID: TerminalThemeId = 'catppuccin_mocha'

export type SessionKind = 'ai' | 'shell' | 'dev_server' | 'logs' | 'test' | 'custom'

export const PIXEL_LAUNCHER_AGENT_OPTIONS = [
  { id: 'auto', label: 'Auto' },
  { id: 'claude', label: 'Claude Code' },
  { id: 'codex', label: 'Codex' }
] as const

export type PixelLauncherAgentId = (typeof PIXEL_LAUNCHER_AGENT_OPTIONS)[number]['id']

export type ResolvedPixelLauncherAgentId = Exclude<PixelLauncherAgentId, 'auto'>

export const DEFAULT_PIXEL_LAUNCHER_AGENT_ID: PixelLauncherAgentId = 'auto'
export const DEFAULT_PIXEL_LAUNCHER_FALLBACK_AGENT_ID: ResolvedPixelLauncherAgentId = 'claude'

export type ProjectChangeRoot = {
  id: string
  path: string
  label?: string
}

export type Project = {
  id: string
  name: string
  color: string
  description: string
  defaultFolder?: string
  changeRoots?: ProjectChangeRoot[]
}

export type TerminalConfig = {
  id: string
  projectId: string
  name: string
  kind: SessionKind
  cwd: string
  commands: string[]
}

export type PromptTemplateScope = 'global' | 'project'

export type PromptTemplate = {
  id: string
  name: string
  description?: string
  body: string
  scope: PromptTemplateScope
  projectId?: string
  createdAt: string
  updatedAt: string
}

export type WorkspaceFeatureSettings = {
  playSoundsUponFinishing: boolean
}

export type WorkspaceCodeEditorSettings = {
  preferredEditor: CodeEditorId
}

export type WorkspacePixelLauncherSettings = {
  preferredAgent: PixelLauncherAgentId
}

export type RunningSessionStatus = 'starting' | 'running' | 'done' | 'error'

export type RunningSession = {
  id: string
  projectId: string
  configId: string
  name: string
  autoLaunchInstruction?: string
  pixelAgent?: PixelLauncherAgentId
  startWithPixel?: boolean
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
  featureSettings?: WorkspaceFeatureSettings
  codeEditorSettings?: WorkspaceCodeEditorSettings
  pixelLauncherSettings?: WorkspacePixelLauncherSettings
  promptTemplates?: PromptTemplate[]
  activeVaultId?: string
  vaults?: VaultConfig[]
  terminalThemeId?: TerminalThemeId
}

export type FolderPickResult = {
  name: string
  path: string
} | null

export type PickFolderOptions = {
  /** Directory the native dialog opens in first */
  defaultPath?: string
}

export type WorkspaceLayout = {
  railWidth: number
  companionWidth: number
  projectsHeight: number
  terminalsHeight: number
}

export type WorkspaceApi = {
  pickFolder: (options?: PickFolderOptions) => Promise<FolderPickResult>
  loadConfig: () => Promise<WorkspaceConfig | null>
  saveConfig: (config: WorkspaceConfig) => Promise<void>
}

export type ViewApi = {
  onResetLayout: (callback: () => void) => () => void
}

export function isTerminalThemeId(value: unknown): value is TerminalThemeId {
  return TERMINAL_THEME_OPTIONS.some((option) => option.id === value)
}
