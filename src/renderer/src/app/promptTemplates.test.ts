import { describe, expect, it } from 'vitest'
import type { PromptTemplate, RunningSession, TerminalConfig } from '../../../shared/workspace'
import {
  createPromptTemplateFromForm,
  getPromptTemplateProjectPath,
  getPromptTemplateSendStatus,
  getPromptTemplatesForProject,
  normalizePromptTemplates,
  renderPromptTemplate
} from './promptTemplates'

const templates: PromptTemplate[] = [
  {
    body: 'global',
    createdAt: '2026-05-04T00:00:00.000Z',
    id: 'global',
    name: 'Global',
    scope: 'global',
    updatedAt: '2026-05-04T00:00:00.000Z'
  },
  {
    body: 'project',
    createdAt: '2026-05-04T00:00:00.000Z',
    id: 'project',
    name: 'Project',
    projectId: 'project-1',
    scope: 'project',
    updatedAt: '2026-05-04T00:00:00.000Z'
  },
  {
    body: 'other',
    createdAt: '2026-05-04T00:00:00.000Z',
    id: 'other',
    name: 'Other',
    projectId: 'project-2',
    scope: 'project',
    updatedAt: '2026-05-04T00:00:00.000Z'
  }
]

const runningSession: RunningSession = {
  commands: ['codex'],
  configId: 'terminal-1',
  cwd: '/repo/session',
  id: 'session-1',
  kind: 'ai',
  metadata: '/repo/session',
  name: 'Assistant',
  projectColor: '#4ea1ff',
  projectId: 'project-1',
  projectName: 'Pixel',
  startedAt: '2026-05-04T00:00:00.000Z',
  status: 'running',
  terminalColor: '#4ea1ff'
}

const terminalConfigs: TerminalConfig[] = [
  {
    commands: ['pnpm dev'],
    cwd: '/repo/config',
    id: 'terminal-1',
    kind: 'dev_server',
    name: 'Dev',
    projectId: 'project-1'
  }
]

describe('promptTemplates', () => {
  it('renders known variables and preserves unknown tokens', () => {
    expect(
      renderPromptTemplate('%project_name at %project_path using %unknown', {
        projectName: 'Pixel',
        projectPath: '/repo'
      })
    ).toBe('Pixel at /repo using %unknown')
  })

  it('filters global and matching project templates', () => {
    expect(
      getPromptTemplatesForProject(templates, 'project-1').map((template) => template.id)
    ).toEqual(['global', 'project'])
  })

  it('uses active session cwd before configured terminal cwd', () => {
    expect(getPromptTemplateProjectPath(runningSession, terminalConfigs)).toBe('/repo/session')
  })

  it('falls back to configured terminal cwd when no session exists', () => {
    expect(getPromptTemplateProjectPath(null, terminalConfigs)).toBe('/repo/config')
  })

  it('disables send without a live session', () => {
    expect(getPromptTemplateSendStatus(null)).toEqual({
      canSend: false,
      message: 'Start a terminal to send a prompt.'
    })
    expect(getPromptTemplateSendStatus({ ...runningSession, status: 'done' })).toEqual({
      canSend: false,
      message: 'Select a running terminal to send a prompt.'
    })
  })

  it('creates project scoped templates only when a project id exists', () => {
    expect(
      createPromptTemplateFromForm(
        {
          body: 'Body',
          description: '',
          name: 'Name',
          scope: 'project'
        },
        {
          createId: () => 'template-1',
          now: '2026-05-04T00:00:00.000Z',
          projectId: 'project-1'
        }
      )
    ).toMatchObject({
      id: 'template-1',
      projectId: 'project-1',
      scope: 'project'
    })
  })

  it('preserves createdAt when editing an existing template', () => {
    expect(
      createPromptTemplateFromForm(
        {
          body: 'Updated body',
          createdAt: '2026-05-01T00:00:00.000Z',
          description: '',
          id: 'existing',
          name: 'Existing',
          scope: 'global'
        },
        {
          createId: () => 'unused',
          now: '2026-05-04T00:00:00.000Z'
        }
      )
    ).toMatchObject({
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-04T00:00:00.000Z'
    })
  })

  it('removes obsolete preset templates from saved config', () => {
    expect(
      normalizePromptTemplates([
        {
          body: 'obsolete',
          createdAt: '2026-05-04T00:00:00.000Z',
          id: 'preset-inspect-project',
          name: 'Inspect project',
          scope: 'global',
          updatedAt: '2026-05-04T00:00:00.000Z'
        },
        templates[0]!
      ]).map((template) => template.id)
    ).toEqual(['global'])
  })
})
