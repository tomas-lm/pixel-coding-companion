import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import type { TerminalContextEvent } from '../../shared/terminal'
import {
  CodexContextTelemetryService,
  applyCodexRolloutRecord,
  createDefaultCodexRolloutState,
  getContextUsedPercent,
  getTerminalContextHudStatus,
  parseCodexRolloutLine,
  shouldTrackCodexContext
} from './codexContextTelemetry'

let tempDir: string | undefined

async function createTempDir(): Promise<string> {
  tempDir = await mkdtemp(join(tmpdir(), 'codex-context-'))
  return tempDir
}

async function waitFor(predicate: () => boolean): Promise<void> {
  const startedAt = Date.now()

  while (Date.now() - startedAt < 2_000) {
    if (predicate()) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }

  throw new Error('Timed out waiting for condition')
}

afterEach(async () => {
  if (!tempDir) return

  await rm(tempDir, { force: true, recursive: true })
  tempDir = undefined
})

describe('codexContextTelemetry', () => {
  it('calculates context percent from the last input tokens and model window', () => {
    expect(getContextUsedPercent(182_779, 258_400)).toBe(70.7)
    expect(getContextUsedPercent(-10, 100)).toBe(0)
    expect(getContextUsedPercent(200, 100)).toBe(100)
    expect(getContextUsedPercent(100, 0)).toBeNull()
    expect(getContextUsedPercent(undefined, 100)).toBeNull()
  })

  it('maps context fill levels to HUD statuses', () => {
    expect(getTerminalContextHudStatus(null)).toBe('unknown')
    expect(getTerminalContextHudStatus(54.9)).toBe('flow')
    expect(getTerminalContextHudStatus(55)).toBe('filling')
    expect(getTerminalContextHudStatus(75)).toBe('compact_soon')
    expect(getTerminalContextHudStatus(90)).toBe('danger')
  })

  it('detects Codex terminal requests without matching unrelated commands', () => {
    expect(
      shouldTrackCodexContext({
        cols: 80,
        commands: ['codex --model gpt-5.2'],
        id: 'codex',
        rows: 24
      })
    ).toBe(true)
    expect(
      shouldTrackCodexContext({
        cols: 80,
        commands: ['codex'],
        id: 'pixel-codex',
        rows: 24,
        startWithPixel: true
      })
    ).toBe(true)
    expect(
      shouldTrackCodexContext({
        cols: 80,
        commands: ['pnpm dev'],
        id: 'dev-server',
        rows: 24
      })
    ).toBe(false)
  })

  it('updates model metadata and ignores total token usage for context percent', () => {
    let state = createDefaultCodexRolloutState()

    let result = applyCodexRolloutRecord(state, {
      payload: { effort: 'high', model: 'gpt-5.2' },
      timestamp: '2026-05-03T12:00:00Z',
      type: 'turn_context'
    })
    expect(result.changed).toBe(true)
    state = result.state

    result = applyCodexRolloutRecord(state, {
      payload: {
        info: {
          last_token_usage: { input_tokens: 50 },
          model_context_window: 200,
          total_token_usage: { input_tokens: 999_999 }
        },
        type: 'token_count'
      },
      timestamp: '2026-05-03T12:00:05Z',
      type: 'event_msg'
    })

    expect(result.state).toMatchObject({
      contextUsedPercent: 25,
      model: 'gpt-5.2',
      reasoningEffort: 'high',
      status: 'flow'
    })
  })

  it('parses rollout JSONL records defensively', () => {
    expect(parseCodexRolloutLine('{"type":"turn_context","payload":{"model":"gpt-5.2"}}')).toEqual({
      payload: { model: 'gpt-5.2' },
      type: 'turn_context'
    })
    expect(parseCodexRolloutLine('not-json')).toBeNull()
  })

  it('discovers matching Codex rollouts and broadcasts snapshots', async () => {
    const root = await createTempDir()
    const cwd = join(root, 'project')
    const rolloutDir = join(root, 'sessions', '2026', '05', '03')
    const rolloutPath = join(rolloutDir, 'rollout-test.jsonl')
    await mkdir(cwd, { recursive: true })
    await mkdir(rolloutDir, { recursive: true })
    await writeFile(
      rolloutPath,
      `${[
        JSON.stringify({
          payload: {
            cwd,
            model_provider: 'openai',
            source: 'cli'
          },
          type: 'session_meta'
        }),
        JSON.stringify({
          payload: { effort: 'medium', model: 'gpt-5.2' },
          timestamp: '2026-05-03T12:00:00Z',
          type: 'turn_context'
        }),
        JSON.stringify({
          payload: {
            info: {
              last_token_usage: { input_tokens: 150 },
              model_context_window: 200
            },
            type: 'token_count'
          },
          timestamp: '2026-05-03T12:00:05Z',
          type: 'event_msg'
        })
      ].join('\n')}\n`,
      'utf8'
    )

    const events: TerminalContextEvent[] = []
    const service = new CodexContextTelemetryService({
      broadcastTerminalContext: (event) => events.push(event),
      getCodexSessionsRoot: () => join(root, 'sessions'),
      pollIntervalMs: 10
    })

    try {
      service.trackTerminal({
        cwd,
        sessionId: 'terminal-1',
        startedAtMs: Date.now() - 1_000
      })

      await waitFor(() => events.some((event) => event.snapshot?.contextUsedPercent === 75))
    } finally {
      service.stopAll()
    }

    expect(events[0]).toMatchObject({
      id: 'terminal-1',
      snapshot: {
        agent: 'codex',
        contextUsedPercent: 75,
        model: 'gpt-5.2',
        reasoningEffort: 'medium',
        status: 'compact_soon',
        terminalSessionId: 'terminal-1'
      }
    })
    expect(events.at(-1)).toEqual({ id: 'terminal-1', snapshot: null })
  })
})
