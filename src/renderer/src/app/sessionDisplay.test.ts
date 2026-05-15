import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Project, RunningSession, TerminalConfig } from '../../../shared/workspace'
import {
  commandsFromText,
  commandsToText,
  getActiveSessionSummary,
  getCompanionMessage,
  getLiveConfigIds,
  getOutputPreview,
  getProjectLiveLabel,
  getProjectSummary,
  getSessionCardDetail,
  getSessionDurationLabel,
  getStatusLabel,
  getTerminalDetail,
  isLiveSession
} from './sessionDisplay'

function createSession(overrides: Partial<RunningSession> = {}): RunningSession {
  return {
    commands: ['pnpm dev'],
    configId: 'terminal-1',
    cwd: '/repo',
    id: 'session-1',
    kind: 'ai',
    lastActivityAt: '2026-05-02T15:00:00.000Z',
    metadata: '/repo',
    name: 'Assistant',
    projectColor: '#4ea1ff',
    projectId: 'project-1',
    projectName: 'Pixel',
    startedAt: '2026-05-02T14:59:00.000Z',
    status: 'running',
    terminalColor: '#4ea1ff',
    ...overrides
  }
}

describe('session display helpers', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-02T15:01:30.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('round-trips terminal command text', () => {
    expect(commandsFromText(' pnpm dev\n\n pnpm test  ')).toEqual(['pnpm dev', 'pnpm test'])
    expect(commandsToText(['pnpm dev', 'pnpm test'])).toBe('pnpm dev\npnpm test')
  })

  it('formats project and terminal details', () => {
    const project: Project = {
      color: '#4ea1ff',
      description: '',
      id: 'project-1',
      name: 'Pixel'
    }
    const config: TerminalConfig = {
      commands: ['pnpm dev', 'pnpm test'],
      cwd: '/repo',
      id: 'terminal-1',
      kind: 'ai',
      name: 'Assistant',
      projectId: 'project-1'
    }

    expect(getProjectSummary(project, [config])).toBe('1 configured terminal - No description')
    expect(getTerminalDetail(config)).toBe('pnpm dev -> pnpm test - /repo')
  })

  it('identifies live sessions and status labels', () => {
    expect(isLiveSession(createSession({ status: 'starting' }))).toBe(true)
    expect(isLiveSession(createSession({ status: 'running' }))).toBe(true)
    expect(isLiveSession(createSession({ status: 'done' }))).toBe(false)
    expect(getStatusLabel('error')).toBe('Error')
  })

  it('formats duration, cards, active summaries and companion copy', () => {
    const session = createSession({
      durationMs: 90500,
      exitCode: 0,
      lastOutputPreview: 'ready',
      status: 'done'
    })

    expect(getSessionDurationLabel(session)).toBe('1m 30s')
    expect(getSessionCardDetail(session)).toBe('Done - 1m 30s - exit 0')
    expect(getActiveSessionSummary(session)).toBe(
      '/repo - duration 1m 30s - 1m ago - exit 0 - ready'
    )
    expect(getCompanionMessage(session)).toBe('Assistant terminou em 1m 30s.')
  })

  it('normalizes output preview text', () => {
    expect(getOutputPreview(`\u001b[31mError\u001b[0m\n  here`)).toBe('Error here')
    expect(getOutputPreview('   ')).toBeNull()
  })

  it('summarizes live configs for a project', () => {
    const sessions = [
      createSession({ configId: 'terminal-1', id: 'session-1', status: 'running' }),
      createSession({ configId: 'terminal-2', id: 'session-2', status: 'starting' }),
      createSession({ configId: 'terminal-3', id: 'session-3', status: 'done' })
    ]

    expect(getProjectLiveLabel('project-1', sessions)).toBe('2 live')
    expect([...getLiveConfigIds('project-1', sessions)]).toEqual(['terminal-1', 'terminal-2'])
  })
})
