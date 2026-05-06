import type { Project, RunningSession, TerminalConfig } from '../../../shared/workspace'

type CreateRunningSessionOptions = {
  fallbackProjectColor: string
  id?: string
  now?: string
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
    useStartWithPixel = false
  }: CreateRunningSessionOptions
): RunningSession {
  const startWithPixel = useStartWithPixel && config.kind === 'ai' && config.commands.length > 0

  return {
    id,
    projectId: config.projectId,
    configId: config.id,
    name: config.name,
    startWithPixel,
    projectColor: project?.color ?? fallbackProjectColor,
    projectName: project?.name ?? 'Unknown project',
    kind: config.kind,
    cwd: config.cwd,
    commands: config.commands,
    status: 'starting',
    metadata: config.cwd || 'home folder',
    startedAt: now,
    lastActivityAt: now
  }
}
