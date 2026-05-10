import {
  DEFAULT_PIXEL_LAUNCHER_AGENT_ID,
  PIXEL_LAUNCHER_AGENT_OPTIONS,
  type PixelLauncherAgentId,
  type WorkspacePixelLauncherSettings
} from '../../../shared/workspace'

export const DEFAULT_WORKSPACE_PIXEL_LAUNCHER_SETTINGS: WorkspacePixelLauncherSettings = {
  preferredAgent: DEFAULT_PIXEL_LAUNCHER_AGENT_ID
}

export function isPixelLauncherAgentId(value: unknown): value is PixelLauncherAgentId {
  return PIXEL_LAUNCHER_AGENT_OPTIONS.some((option) => option.id === value)
}

export function normalizeWorkspacePixelLauncherSettings(
  value: unknown
): WorkspacePixelLauncherSettings {
  if (!value || typeof value !== 'object') {
    return DEFAULT_WORKSPACE_PIXEL_LAUNCHER_SETTINGS
  }

  const settings = value as Partial<Record<keyof WorkspacePixelLauncherSettings, unknown>>

  return {
    preferredAgent: isPixelLauncherAgentId(settings.preferredAgent)
      ? settings.preferredAgent
      : DEFAULT_WORKSPACE_PIXEL_LAUNCHER_SETTINGS.preferredAgent
  }
}
