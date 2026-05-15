import { describe, expect, it } from 'vitest'
import type { CompanionBridgeMessage, CompanionProgressState } from '../../../shared/companion'
import type { CompanionStoreState } from '../../../shared/companionStore'
import type { Project, TerminalConfig } from '../../../shared/workspace'
import {
  getActiveCompanionProgress,
  getCompanionMessageColor,
  getProjectForCompanionMessage
} from './companionSelectors'

const projects: Project[] = [
  {
    color: '#4ea1ff',
    description: 'Primary app',
    id: 'pixel',
    name: 'Pixel Companion'
  },
  {
    color: '#ef5b5b',
    description: 'Client app',
    id: 'azul',
    name: 'Ázul Cliente'
  }
]

const terminalConfigs: TerminalConfig[] = [
  {
    commands: ['pnpm dev'],
    cwd: '/repo/pixel',
    id: 'terminal-pixel',
    kind: 'ai',
    name: 'Assistant',
    projectId: 'pixel'
  },
  {
    accentColor: '#7fe7dc',
    commands: ['codex'],
    cwd: '/repo/pixel/reviewer',
    id: 'terminal-reviewer',
    kind: 'ai',
    name: 'Reviewer',
    projectId: 'pixel'
  },
  {
    commands: ['pnpm test'],
    cwd: '/repo/azul',
    id: 'terminal-azul',
    kind: 'test',
    name: 'Tests',
    projectId: 'azul'
  }
]

function createMessage(overrides: Partial<CompanionBridgeMessage>): CompanionBridgeMessage {
  return {
    cliState: 'done',
    createdAt: '2026-05-02T15:00:00.000Z',
    id: 'message-1',
    source: 'mcp',
    summary: 'Finished',
    title: 'Assistant',
    ...overrides
  }
}

describe('companion selectors', () => {
  it('builds progress for the active companion entry', () => {
    const progress: CompanionProgressState = {
      currentXp: 0,
      level: 0,
      maxLevel: 100,
      monsterPoints: 2500,
      name: 'Ghou',
      progressRatio: 0,
      totalXp: 0,
      xpForNextLevel: 120
    }
    const storeState = {
      activeCompanionId: 'frogo',
      companions: {
        frogo: {
          currentXp: 60,
          level: 0,
          owned: true,
          totalXp: 60,
          updatedAt: '2026-05-02T15:00:00.000Z'
        }
      },
      dailyAccess: {
        boxClaims: {},
        currentStreak: 1,
        longestStreak: 1,
        recentVisitDates: ['2026-05-02'],
        totalVisitDays: 1
      },
      recentOpenings: [],
      starterSelected: true
    } satisfies CompanionStoreState

    expect(getActiveCompanionProgress(progress, storeState)).toMatchObject({
      currentXp: 60,
      level: 0,
      monsterPoints: 2500,
      name: 'Frogo',
      totalXp: 60,
      updatedAt: '2026-05-02T15:00:00.000Z'
    })
  })

  it('finds message project by explicit id, cwd, terminal name, or normalized project name', () => {
    expect(
      getProjectForCompanionMessage(
        createMessage({ projectId: 'pixel' }),
        projects,
        terminalConfigs
      )
    ).toBe(projects[0])
    expect(
      getProjectForCompanionMessage(
        createMessage({ cwd: '/repo/azul/src' }),
        projects,
        terminalConfigs
      )
    ).toBe(projects[1])
    expect(
      getProjectForCompanionMessage(
        createMessage({ sessionName: 'assistant' }),
        projects,
        terminalConfigs
      )
    ).toBe(projects[0])
    expect(
      getProjectForCompanionMessage(
        createMessage({ projectName: 'Azul Cliente', title: 'Release' }),
        projects,
        terminalConfigs
      )
    ).toBe(projects[1])
  })

  it('falls back to message color and then active project color', () => {
    expect(
      getCompanionMessageColor(
        createMessage({ projectId: 'pixel', projectColor: '#000000' }),
        projects,
        terminalConfigs,
        '#ffffff'
      )
    ).toBe('#4ea1ff')
    expect(
      getCompanionMessageColor(
        createMessage({ projectColor: '#000000', title: 'Release' }),
        projects,
        terminalConfigs,
        '#ffffff'
      )
    ).toBe('#000000')
    expect(
      getCompanionMessageColor(
        createMessage({ title: 'Release' }),
        projects,
        terminalConfigs,
        '#ffffff'
      )
    ).toBe('#ffffff')
  })

  it('prefers terminal colors over project colors for terminal-scoped messages', () => {
    expect(
      getCompanionMessageColor(
        createMessage({ projectId: 'pixel', terminalId: 'terminal-reviewer' }),
        projects,
        terminalConfigs,
        '#ffffff'
      )
    ).toBe('#7fe7dc')
    expect(
      getCompanionMessageColor(
        createMessage({ projectId: 'pixel', terminalColor: '#ff8bd1', title: 'Release' }),
        projects,
        terminalConfigs,
        '#ffffff'
      )
    ).toBe('#ff8bd1')
  })
})
