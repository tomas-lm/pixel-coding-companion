import { describe, expect, it } from 'vitest'
import type { Project, TerminalConfig } from '../../../shared/workspace'
import { createRunningSession } from './runningSessions'

const project: Project = {
  color: '#4ea1ff',
  description: 'Main workspace',
  id: 'project-1',
  name: 'Pixel'
}

const config: TerminalConfig = {
  commands: ['pnpm dev'],
  cwd: '/repo',
  id: 'terminal-1',
  kind: 'ai',
  name: 'Assistant',
  projectId: project.id
}

describe('running sessions', () => {
  it('creates a deterministic starting session from a terminal config', () => {
    expect(
      createRunningSession(config, project, {
        fallbackProjectColor: '#ffffff',
        id: 'session-1',
        now: '2026-05-02T15:00:00.000Z',
        useStartWithPixel: true
      })
    ).toEqual({
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
      startWithPixel: true,
      startedAt: '2026-05-02T15:00:00.000Z',
      status: 'starting'
    })
  })

  it('only enables Pixel auto-start for AI configs with commands', () => {
    expect(
      createRunningSession({ ...config, commands: [], kind: 'ai' }, project, {
        fallbackProjectColor: '#ffffff',
        id: 'session-1',
        now: '2026-05-02T15:00:00.000Z',
        useStartWithPixel: true
      }).startWithPixel
    ).toBe(false)
    expect(
      createRunningSession({ ...config, kind: 'shell' }, project, {
        fallbackProjectColor: '#ffffff',
        id: 'session-1',
        now: '2026-05-02T15:00:00.000Z',
        useStartWithPixel: true
      }).startWithPixel
    ).toBe(false)
  })
})
