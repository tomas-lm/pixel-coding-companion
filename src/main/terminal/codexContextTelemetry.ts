import { open, readdir, stat } from 'fs/promises'
import { resolve } from 'path'
import {
  type TerminalContextEvent,
  type TerminalContextHudSnapshot,
  type TerminalContextHudStatus,
  type TerminalSessionId,
  type TerminalStartRequest
} from '../../shared/terminal'

const CODEX_COMMAND_PATTERN = /^(?:codex|pixel\s+codex|node\s+.+pixel\.mjs['"]?\s+codex)(?:\s|$)/
const CODEX_DISCOVERY_GRACE_MS = 30_000
const DEFAULT_POLL_INTERVAL_MS = 1_500

type CodexRolloutRecord = {
  payload?: unknown
  timestamp?: unknown
  type?: unknown
}

type CodexRolloutSessionMeta = {
  cwd?: unknown
  id?: unknown
  model_provider?: unknown
  source?: unknown
}

type CodexRolloutState = {
  contextUsedPercent: number | null
  model: string | null
  reasoningEffort: string | null
  status: TerminalContextHudStatus
  updatedAt: string | null
}

type CodexTerminalMonitor = CodexRolloutState & {
  cwd: string
  emittedKey: string | null
  interval: ReturnType<typeof setInterval>
  pendingText: string
  rolloutPath: string | null
  sessionId: TerminalSessionId
  startedAtMs: number
  tailOffset: number
}

export type CodexContextTelemetryDependencies = {
  broadcastTerminalContext: (event: TerminalContextEvent) => void
  getCodexSessionsRoot: () => string
  pollIntervalMs?: number
}

export type TrackCodexTerminalRequest = {
  cwd: string
  sessionId: TerminalSessionId
  startedAtMs: number
}

export function isCodexCommand(command: string): boolean {
  return CODEX_COMMAND_PATTERN.test(command.trim())
}

export function shouldTrackCodexContext(request: TerminalStartRequest): boolean {
  return Boolean(
    request.commands?.some((command) => {
      const trimmedCommand = command.trim()
      return (
        isCodexCommand(trimmedCommand) ||
        Boolean(request.startWithPixel && /^codex(?:\s|$)/.test(trimmedCommand))
      )
    })
  )
}

export function getTerminalContextHudStatus(
  contextUsedPercent: number | null
): TerminalContextHudStatus {
  if (contextUsedPercent === null) return 'unknown'
  if (contextUsedPercent < 55) return 'flow'
  if (contextUsedPercent < 75) return 'filling'
  if (contextUsedPercent < 90) return 'compact_soon'
  return 'danger'
}

export function getContextUsedPercent(
  inputTokens: unknown,
  modelContextWindow: unknown
): number | null {
  if (
    typeof inputTokens !== 'number' ||
    typeof modelContextWindow !== 'number' ||
    !Number.isFinite(inputTokens) ||
    !Number.isFinite(modelContextWindow) ||
    modelContextWindow <= 0
  ) {
    return null
  }

  const percent = (Math.max(0, inputTokens) / modelContextWindow) * 100
  return Math.round(Math.min(percent, 100) * 10) / 10
}

export function createDefaultCodexRolloutState(): CodexRolloutState {
  return {
    contextUsedPercent: null,
    model: null,
    reasoningEffort: null,
    status: 'unknown',
    updatedAt: null
  }
}

export function applyCodexRolloutRecord(
  state: CodexRolloutState,
  record: CodexRolloutRecord
): { changed: boolean; state: CodexRolloutState } {
  if (!record || typeof record !== 'object') return { changed: false, state }

  const payload = record.payload
  if (!payload || typeof payload !== 'object') return { changed: false, state }

  if (record.type === 'turn_context') {
    const turnContext = payload as { effort?: unknown; model?: unknown }
    const model = typeof turnContext.model === 'string' ? turnContext.model : state.model
    const reasoningEffort =
      typeof turnContext.effort === 'string' ? turnContext.effort : state.reasoningEffort
    const updatedAt = typeof record.timestamp === 'string' ? record.timestamp : state.updatedAt
    const nextState = {
      ...state,
      model,
      reasoningEffort,
      updatedAt
    }

    return {
      changed: !areRolloutStatesEqual(state, nextState),
      state: nextState
    }
  }

  const eventPayload = payload as {
    info?: {
      last_token_usage?: { input_tokens?: unknown }
      model_context_window?: unknown
    }
    type?: unknown
  }
  if (record.type !== 'event_msg' || eventPayload.type !== 'token_count') {
    return { changed: false, state }
  }

  const contextUsedPercent = getContextUsedPercent(
    eventPayload.info?.last_token_usage?.input_tokens,
    eventPayload.info?.model_context_window
  )
  const nextState = {
    ...state,
    contextUsedPercent,
    status: getTerminalContextHudStatus(contextUsedPercent),
    updatedAt: typeof record.timestamp === 'string' ? record.timestamp : state.updatedAt
  }

  return {
    changed: !areRolloutStatesEqual(state, nextState),
    state: nextState
  }
}

export function parseCodexRolloutLine(line: string): CodexRolloutRecord | null {
  try {
    const record = JSON.parse(line)
    return record && typeof record === 'object' ? record : null
  } catch {
    return null
  }
}

function areRolloutStatesEqual(a: CodexRolloutState, b: CodexRolloutState): boolean {
  return (
    a.contextUsedPercent === b.contextUsedPercent &&
    a.model === b.model &&
    a.reasoningEffort === b.reasoningEffort &&
    a.status === b.status &&
    a.updatedAt === b.updatedAt
  )
}

function createSnapshot(monitor: CodexTerminalMonitor): TerminalContextHudSnapshot {
  return {
    agent: 'codex',
    contextUsedPercent: monitor.contextUsedPercent,
    model: monitor.model,
    reasoningEffort: monitor.reasoningEffort,
    status: monitor.status,
    terminalSessionId: monitor.sessionId,
    updatedAt: monitor.updatedAt
  }
}

function getSnapshotKey(snapshot: TerminalContextHudSnapshot): string {
  return JSON.stringify(snapshot)
}

function pathsMatch(a: string, b: string): boolean {
  return resolve(a) === resolve(b)
}

async function listRolloutFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true })
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = `${root}/${entry.name}`

      if (entry.isDirectory()) return listRolloutFiles(entryPath)
      if (entry.isFile() && /^rollout-.+\.jsonl$/.test(entry.name)) return [entryPath]
      return []
    })
  )

  return files.flat()
}

async function readSessionMeta(filePath: string): Promise<CodexRolloutSessionMeta | null> {
  const fileHandle = await open(filePath, 'r')
  try {
    const buffer = Buffer.alloc(4096)
    const { bytesRead } = await fileHandle.read(buffer, 0, buffer.length, 0)
    const firstLine = buffer.toString('utf8', 0, bytesRead).split(/\r?\n/, 1)[0]
    const record = parseCodexRolloutLine(firstLine)

    if (record?.type !== 'session_meta') return null
    return record.payload && typeof record.payload === 'object'
      ? (record.payload as CodexRolloutSessionMeta)
      : null
  } finally {
    await fileHandle.close()
  }
}

async function findCodexRolloutFile(
  root: string,
  monitor: CodexTerminalMonitor
): Promise<string | null> {
  let candidates: { filePath: string; mtimeMs: number }[] = []
  try {
    const files = await listRolloutFiles(root)
    const minMtimeMs = monitor.startedAtMs - CODEX_DISCOVERY_GRACE_MS
    const stats = await Promise.all(
      files.map(async (filePath) => ({
        filePath,
        stats: await stat(filePath)
      }))
    )
    candidates = stats
      .filter((candidate) => candidate.stats.mtimeMs >= minMtimeMs)
      .map((candidate) => ({
        filePath: candidate.filePath,
        mtimeMs: candidate.stats.mtimeMs
      }))
      .sort((a, b) => b.mtimeMs - a.mtimeMs)
  } catch {
    return null
  }

  for (const candidate of candidates) {
    const meta = await readSessionMeta(candidate.filePath)
    if (
      meta?.model_provider === 'openai' &&
      meta.source === 'cli' &&
      typeof meta.cwd === 'string' &&
      pathsMatch(meta.cwd, monitor.cwd)
    ) {
      return candidate.filePath
    }
  }

  return null
}

async function readNewRolloutLines(
  monitor: CodexTerminalMonitor
): Promise<{ lines: string[]; nextOffset: number; pendingText: string }> {
  if (!monitor.rolloutPath) return { lines: [], nextOffset: monitor.tailOffset, pendingText: '' }

  const fileStats = await stat(monitor.rolloutPath)
  const tailOffset = fileStats.size < monitor.tailOffset ? 0 : monitor.tailOffset
  const bytesToRead = fileStats.size - tailOffset
  if (bytesToRead <= 0) {
    return {
      lines: [],
      nextOffset: fileStats.size,
      pendingText: monitor.pendingText
    }
  }

  const fileHandle = await open(monitor.rolloutPath, 'r')
  try {
    const buffer = Buffer.alloc(bytesToRead)
    await fileHandle.read(buffer, 0, bytesToRead, tailOffset)
    const text = `${tailOffset === 0 ? '' : monitor.pendingText}${buffer.toString('utf8')}`
    const lines = text.split(/\r?\n/)
    const endsWithNewline = /\r?\n$/.test(text)
    const pendingText = endsWithNewline ? '' : (lines.pop() ?? '')

    return {
      lines: lines.filter(Boolean),
      nextOffset: fileStats.size,
      pendingText
    }
  } finally {
    await fileHandle.close()
  }
}

export class CodexContextTelemetryService {
  private readonly monitors = new Map<TerminalSessionId, CodexTerminalMonitor>()
  private readonly pollIntervalMs: number

  constructor(private readonly dependencies: CodexContextTelemetryDependencies) {
    this.pollIntervalMs = dependencies.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS
  }

  trackTerminal(request: TrackCodexTerminalRequest): void {
    this.stopTerminal(request.sessionId)

    const state = createDefaultCodexRolloutState()
    const monitor: CodexTerminalMonitor = {
      ...state,
      cwd: request.cwd,
      emittedKey: null,
      interval: setInterval(() => {
        void this.pollTerminal(request.sessionId)
      }, this.pollIntervalMs),
      pendingText: '',
      rolloutPath: null,
      sessionId: request.sessionId,
      startedAtMs: request.startedAtMs,
      tailOffset: 0
    }
    this.monitors.set(request.sessionId, monitor)
    void this.pollTerminal(request.sessionId)
  }

  stopTerminal(sessionId: TerminalSessionId): void {
    const monitor = this.monitors.get(sessionId)
    if (!monitor) return

    clearInterval(monitor.interval)
    this.monitors.delete(sessionId)
    this.dependencies.broadcastTerminalContext({
      id: sessionId,
      snapshot: null
    })
  }

  stopAll(): void {
    for (const sessionId of [...this.monitors.keys()]) {
      this.stopTerminal(sessionId)
    }
  }

  private async pollTerminal(sessionId: TerminalSessionId): Promise<void> {
    const monitor = this.monitors.get(sessionId)
    if (!monitor) return

    try {
      if (!monitor.rolloutPath) {
        monitor.rolloutPath = await findCodexRolloutFile(
          this.dependencies.getCodexSessionsRoot(),
          monitor
        )
      }

      if (!monitor.rolloutPath) return

      const { lines, nextOffset, pendingText } = await readNewRolloutLines(monitor)
      monitor.tailOffset = nextOffset
      monitor.pendingText = pendingText

      let changed = false
      for (const line of lines) {
        const record = parseCodexRolloutLine(line)
        if (!record) continue

        const result = applyCodexRolloutRecord(monitor, record)
        changed ||= result.changed
        Object.assign(monitor, result.state)
      }

      if (changed) this.emitSnapshot(monitor)
    } catch {
      // Telemetry must never affect the terminal process.
    }
  }

  private emitSnapshot(monitor: CodexTerminalMonitor): void {
    const snapshot = createSnapshot(monitor)
    const snapshotKey = getSnapshotKey(snapshot)
    if (snapshotKey === monitor.emittedKey) return

    monitor.emittedKey = snapshotKey
    this.dependencies.broadcastTerminalContext({
      id: monitor.sessionId,
      snapshot
    })
  }
}
