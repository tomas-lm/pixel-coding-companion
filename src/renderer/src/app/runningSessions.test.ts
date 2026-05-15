import { describe, expect, it } from 'vitest'
import type { Project, RunningSession, TerminalConfig } from '../../../shared/workspace'
import { createRunningSession, findReusableSessionForConfig } from './runningSessions'

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
        pixelAgent: 'claude',
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
      pixelAgent: 'claude',
      projectColor: '#4ea1ff',
      projectId: 'project-1',
      projectName: 'Pixel',
      startWithPixel: true,
      startedAt: '2026-05-02T15:00:00.000Z',
      status: 'starting',
      terminalColor: '#4ea1ff'
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

  it('reuses live sessions for non-shell configs', () => {
    const liveSession: RunningSession = {
      commands: config.commands,
      configId: config.id,
      cwd: config.cwd,
      id: 'session-1',
      kind: config.kind,
      lastActivityAt: '2026-05-02T15:00:00.000Z',
      metadata: config.cwd,
      name: config.name,
      projectColor: project.color,
      projectId: project.id,
      projectName: project.name,
      startedAt: '2026-05-02T15:00:00.000Z',
      status: 'running',
      terminalColor: project.color
    }

    expect(findReusableSessionForConfig(config, [liveSession])).toEqual(liveSession)
  })

  it('does not reuse live sessions for shell configs', () => {
    const shellConfig: TerminalConfig = {
      ...config,
      kind: 'shell'
    }
    const liveShellSession: RunningSession = {
      commands: shellConfig.commands,
      configId: shellConfig.id,
      cwd: shellConfig.cwd,
      id: 'session-2',
      kind: shellConfig.kind,
      lastActivityAt: '2026-05-02T15:00:00.000Z',
      metadata: shellConfig.cwd,
      name: shellConfig.name,
      projectColor: project.color,
      projectId: project.id,
      projectName: project.name,
      startedAt: '2026-05-02T15:00:00.000Z',
      status: 'running',
      terminalColor: project.color
    }

    expect(findReusableSessionForConfig(shellConfig, [liveShellSession])).toBeNull()
  })

  it('does not keep a Pixel agent when Start with Pixel is disabled', () => {
    expect(
      createRunningSession(config, project, {
        fallbackProjectColor: '#ffffff',
        id: 'session-1',
        now: '2026-05-02T15:00:00.000Z',
        pixelAgent: 'claude',
        useStartWithPixel: false
      }).pixelAgent
    ).toBeUndefined()
  })
})
