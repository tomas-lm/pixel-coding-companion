import { describe, expect, it } from 'vitest'
import {
  calculateTurnXp,
  getMessageSignature,
  getTurnKey,
  normalizeProgress,
  pruneActiveTurns
} from './companion-xp-awards.mjs'

describe('companion-xp-awards', () => {
  it('normalizes progress with defaults and bounded recent awards', () => {
    const progress = normalizeProgress(
      {
        activeTurns: {
          turn: { startedAt: '2026-05-02T10:00:00.000Z' },
          bad: {}
        },
        recentAwards: Array.from({ length: 170 }, (_, index) => ({
          createdAt: '2026-05-02T10:00:00.000Z',
          messageId: `message-${index}`,
          xp: index
        }))
      },
      'Frogo'
    )

    expect(progress.name).toBe('Frogo')
    expect(Object.keys(progress.activeTurns)).toEqual(['turn'])
    expect(progress.recentAwards).toHaveLength(160)
    expect(progress.recentAwards[0].messageId).toBe('message-10')
  })

  it('creates stable turn keys and signatures', () => {
    const message = {
      agentName: 'Codex',
      projectId: 'project-1',
      sessionName: 'Dev',
      summary: 'Feito',
      terminalId: 'terminal-1'
    }

    expect(getTurnKey(message)).toBe('terminal-1|project-1|Dev|Codex')
    expect(getMessageSignature(message)).toHaveLength(16)
  })

  it('prunes stale active turns', () => {
    expect(
      pruneActiveTurns(
        {
          fresh: { startedAt: '2026-05-02T10:00:00.000Z' },
          stale: { startedAt: '2026-05-02T01:00:00.000Z' }
        },
        Date.parse('2026-05-02T11:00:00.000Z')
      )
    ).toEqual({
      fresh: { startedAt: '2026-05-02T10:00:00.000Z' }
    })
  })

  it('calculates reduced duplicate XP and capped regular XP', () => {
    expect(
      calculateTurnXp({
        duplicate: true,
        durationMs: 20 * 60 * 1000,
        hasWorking: true,
        message: { cliState: 'done', details: '', summary: '' }
      })
    ).toEqual({ reason: 'duplicate_reduced', xp: 2 })

    expect(
      calculateTurnXp({
        duplicate: false,
        durationMs: 60 * 60 * 1000,
        hasWorking: true,
        message: { cliState: 'done', details: 'x'.repeat(2000), summary: 'done' }
      }).xp
    ).toBe(36)
  })
})
