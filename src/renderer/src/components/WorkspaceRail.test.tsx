import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Project, RunningSession, TerminalConfig } from '../../../shared/workspace'
import { WorkspaceRail } from './WorkspaceRail'

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

const session: RunningSession = {
  commands: ['pnpm dev'],
  configId: config.id,
  cwd: '/repo',
  id: 'session-1',
  kind: 'ai',
  lastActivityAt: '2026-05-02T15:00:00.000Z',
  metadata: '/repo',
  name: 'Assistant',
  projectColor: project.color,
  projectId: project.id,
  projectName: project.name,
  startedAt: '2026-05-02T15:00:00.000Z',
  status: 'running',
  terminalColor: project.color
}

describe('WorkspaceRail', () => {
  it('renders projects, configured terminals and running sessions', () => {
    render(
      <WorkspaceRail
        activeProject={project}
        activeProjectConfigs={[config]}
        activeProjectSessions={[session]}
        onClearTerminalHoverCard={vi.fn()}
        onCreateProject={vi.fn()}
        onCreateTerminal={vi.fn()}
        onEditProject={vi.fn()}
        onEditTerminal={vi.fn()}
        onResizePointerDown={vi.fn()}
        onScheduleTerminalHoverCard={vi.fn()}
        onReorderProjects={vi.fn()}
        onReorderRunning={vi.fn()}
        onReorderTerminals={vi.fn()}
        onSelectProject={vi.fn()}
        onSelectSession={vi.fn()}
        onStartConfig={vi.fn()}
        onStartWorkspace={vi.fn()}
        onStopSession={vi.fn()}
        projects={[project]}
        runningSessions={[session]}
        selectedSessionId={session.id}
      />
    )

    expect(screen.getByText('Pixel')).toBeInTheDocument()
    expect(screen.getAllByText('Assistant')).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Stop Assistant' })).toBeInTheDocument()
    expect(screen.getByText('1 live')).toBeInTheDocument()
  })

  it('renders unread completion badges for a project and session', () => {
    render(
      <WorkspaceRail
        activeProject={project}
        activeProjectConfigs={[config]}
        activeProjectSessions={[session]}
        onClearTerminalHoverCard={vi.fn()}
        onCreateProject={vi.fn()}
        onCreateTerminal={vi.fn()}
        onEditProject={vi.fn()}
        onEditTerminal={vi.fn()}
        onResizePointerDown={vi.fn()}
        onScheduleTerminalHoverCard={vi.fn()}
        onReorderProjects={vi.fn()}
        onReorderRunning={vi.fn()}
        onReorderTerminals={vi.fn()}
        onSelectProject={vi.fn()}
        onSelectSession={vi.fn()}
        onStartConfig={vi.fn()}
        onStartWorkspace={vi.fn()}
        onStopSession={vi.fn()}
        projects={[project]}
        runningSessions={[session]}
        selectedSessionId={null}
        unreadSessionIds={[session.id]}
      />
    )

    expect(
      screen.getByRole('status', { name: 'Pixel has unread terminal completion' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('status', { name: 'Assistant has unread completion' })
    ).toBeInTheDocument()
  })
})
