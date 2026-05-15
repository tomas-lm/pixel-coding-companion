import type {
  PixelLauncherAgentId,
  Project,
  RunningSession,
  TerminalConfig
} from '../../../shared/workspace'
import { getTerminalAccentColor } from './terminalAccentColors'

type CreateRunningSessionOptions = {
  fallbackProjectColor: string
  id?: string
  now?: string
  pixelAgent?: PixelLauncherAgentId
  projectTerminalConfigs?: TerminalConfig[]
  terminalColor?: string
  useStartWithPixel?: boolean
}

const LIVE_SESSION_STATUSES = new Set<RunningSession['status']>(['starting', 'running'])

function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}

export function findReusableSessionForConfig(
  config: TerminalConfig,
  runningSessions: RunningSession[]
): RunningSession | null {
  if (config.kind === 'shell') {
    return null
  }

  return (
    runningSessions.find(
      (session) => session.configId === config.id && LIVE_SESSION_STATUSES.has(session.status)
    ) ?? null
  )
}

export function createRunningSession(
  config: TerminalConfig,
  project: Project | null,
  {
    fallbackProjectColor,
    id = createId('session'),
    now = new Date().toISOString(),
    pixelAgent,
    projectTerminalConfigs,
    terminalColor,
    useStartWithPixel = false
  }: CreateRunningSessionOptions
): RunningSession {
  const startWithPixel = useStartWithPixel && config.kind === 'ai' && config.commands.length > 0
  const projectColor = project?.color ?? fallbackProjectColor

  return {
    id,
    projectId: config.projectId,
    configId: config.id,
    name: config.name,
    ...(startWithPixel && pixelAgent ? { pixelAgent } : {}),
    startWithPixel,
    projectColor,
    projectName: project?.name ?? 'Unknown project',
    terminalColor:
      terminalColor ??
      getTerminalAccentColor(config, project, projectTerminalConfigs ?? [config], projectColor),
    kind: config.kind,
    cwd: config.cwd,
    commands: config.commands,
    status: 'starting',
    metadata: config.cwd || 'home folder',
    startedAt: now,
    lastActivityAt: now
  }
}
