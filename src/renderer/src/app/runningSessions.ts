import type { Project, RunningSession, TerminalConfig } from '../../../shared/workspace'

type CreateRunningSessionOptions = {
  fallbackProjectColor: string
  id?: string
  now?: string
  useStartWithPixel?: boolean
}

function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
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
