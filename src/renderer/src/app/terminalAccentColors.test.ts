import { describe, expect, it } from 'vitest'
import type { Project, TerminalConfig } from '../../../shared/workspace'
import {
  deriveTerminalAccentColor,
  getTerminalAccentColor,
  normalizeHexColor
} from './terminalAccentColors'

const project: Project = {
  color: '#4ea1ff',
  description: 'Main workspace',
  id: 'project-1',
  name: 'Pixel'
}

const configs: TerminalConfig[] = [
  {
    commands: ['codex'],
    cwd: '/repo',
    id: 'terminal-1',
    kind: 'ai',
    name: 'Codex',
    projectId: project.id
  },
  {
    commands: ['claude'],
    cwd: '/repo',
    id: 'terminal-2',
    kind: 'ai',
    name: 'Claude',
    projectId: project.id
  }
]

describe('terminal accent colors', () => {
  it('normalizes valid hex colors only', () => {
    expect(normalizeHexColor(' #AABBCC ')).toBe('#aabbcc')
    expect(normalizeHexColor('blue')).toBeNull()
  })

  it('uses explicit terminal color before deriving from the project', () => {
    expect(
      getTerminalAccentColor({ ...configs[0], accentColor: '#FF8BD1' }, project, configs)
    ).toBe('#ff8bd1')
  })

  it('derives distinct stable colors by terminal order', () => {
    const firstColor = getTerminalAccentColor(configs[0], project, configs)
    const secondColor = getTerminalAccentColor(configs[1], project, configs)

    expect(firstColor).toBe(project.color)
    expect(secondColor).not.toBe(firstColor)
    expect(getTerminalAccentColor(configs[1], project, configs)).toBe(secondColor)
  })

  it('falls back to the default color when project color is invalid', () => {
    expect(deriveTerminalAccentColor('not-a-color', 0, 'terminal-1')).toBe('#4ea1ff')
  })
})
