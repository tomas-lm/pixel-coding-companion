import type {
  Project,
  RunningSession,
  RunningSessionStatus,
  SessionKind,
  TerminalConfig
} from '../../../shared/workspace'

export const KIND_LABELS: Record<SessionKind, string> = {
  ai: 'AI',
  shell: 'Shell',
  dev_server: 'Dev Server',
  logs: 'Logs',
  test: 'Test',
  custom: 'Custom'
}

const SESSION_STATUS_LABELS: Record<RunningSessionStatus, string> = {
  starting: 'Starting',
  running: 'Running',
  done: 'Done',
  error: 'Error'
}

const ANSI_SEQUENCE_PATTERN = new RegExp(`${String.fromCharCode(27)}\\[[0-9;?]*[ -/]*[@-~]`, 'g')
const ACTIVE_SESSION_STATUSES = new Set<RunningSessionStatus>(['starting', 'running'])

export function commandsFromText(commandsText: string): string[] {
  return commandsText
    .split('\n')
    .map((command) => command.trim())
    .filter(Boolean)
}

export function commandsToText(commands: string[]): string {
  return commands.join('\n')
}

export function getProjectSummary(project: Project, configs: TerminalConfig[]): string {
  const configuredCount = configs.filter((config) => config.projectId === project.id).length
  const suffix = configuredCount === 1 ? 'terminal' : 'terminals'

  return `${configuredCount} configured ${suffix} - ${project.description || 'No description'}`
}

export function getTerminalCommandDetail(config: TerminalConfig): string {
  return config.commands.length > 0 ? config.commands.join(' -> ') : 'interactive shell'
}

export function getTerminalDetail(config: TerminalConfig): string {
  const command = getTerminalCommandDetail(config)
  return `${command} - ${config.cwd || 'home folder'}`
}

export function isLiveSession(session: RunningSession): boolean {
  return ACTIVE_SESSION_STATUSES.has(session.status)
}

export function getStatusLabel(status: RunningSessionStatus): string {
  return SESSION_STATUS_LABELS[status]
}

export function getTimeMs(value?: string): number | null {
  if (!value) return null

  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : null
}

function formatDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000))
  if (totalSeconds < 1) return '<1s'
  if (totalSeconds < 60) return `${totalSeconds}s`

  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes < 60) return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`

  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`
}

export function getSessionDurationMs(session: RunningSession): number | null {
  if (typeof session.durationMs === 'number') return session.durationMs

  const startedAt = getTimeMs(session.startedAt)
  if (!startedAt) return null

  const endedAt = getTimeMs(session.endedAt) ?? Date.now()
  return Math.max(0, endedAt - startedAt)
}

export function getSessionDurationLabel(session: RunningSession): string | null {
  const durationMs = getSessionDurationMs(session)
  return typeof durationMs === 'number' ? formatDuration(durationMs) : null
}

export function getLastActivityLabel(session: RunningSession): string | null {
  const lastActivityAt = getTimeMs(session.lastActivityAt)
  if (!lastActivityAt) return null

  const secondsAgo = Math.max(0, Math.floor((Date.now() - lastActivityAt) / 1000))
  if (secondsAgo < 5) return 'active now'
  if (secondsAgo < 60) return `${secondsAgo}s ago`

  const minutesAgo = Math.floor(secondsAgo / 60)
  if (minutesAgo < 60) return `${minutesAgo}m ago`

  const hoursAgo = Math.floor(minutesAgo / 60)
  return `${hoursAgo}h ago`
}

export function getOutputPreview(output: string): string | null {
  const preview = output.replace(ANSI_SEQUENCE_PATTERN, '').replace(/\s+/g, ' ').trim()

  if (!preview) return null
  return preview.length > 120 ? preview.slice(-120) : preview
}

export function getSessionCardDetail(session: RunningSession): string {
  const duration = getSessionDurationLabel(session)
  const exit = typeof session.exitCode === 'number' ? `exit ${session.exitCode}` : null
  const details = [getStatusLabel(session.status), duration, exit].filter(Boolean)

  return details.join(' - ')
}

export function getActiveSessionSummary(session: RunningSession): string {
  const duration = getSessionDurationLabel(session)
  const activity = getLastActivityLabel(session)
  const exit = typeof session.exitCode === 'number' ? `exit ${session.exitCode}` : null
  const details = [session.metadata, duration ? `duration ${duration}` : null, activity, exit]
    .filter(Boolean)
    .join(' - ')

  return session.lastOutputPreview ? `${details} - ${session.lastOutputPreview}` : details
}

export function getProjectLiveLabel(projectId: string, runningSessions: RunningSession[]): string {
  const liveCount = runningSessions.filter(
    (session) => session.projectId === projectId && isLiveSession(session)
  ).length

  if (liveCount === 1) return '1 live'
  if (liveCount > 1) return `${liveCount} live`
  return 'ready'
}

export function getLiveConfigIds(
  projectId: string,
  runningSessions: RunningSession[]
): Set<string> {
  return new Set(
    runningSessions
      .filter((session) => session.projectId === projectId && isLiveSession(session))
      .map((session) => session.configId)
  )
}

export function getCompanionMessage(session: RunningSession | null): string {
  if (!session) return 'Workspace pronto.'
  if (session.status === 'starting') return `${session.name} esta iniciando.`
  if (session.status === 'running') return `${session.name} esta ativo.`
  if (session.status === 'done')
    return `${session.name} terminou em ${getSessionDurationLabel(session) ?? 'pouco tempo'}.`
  return `${session.name} precisa de atencao.`
}
