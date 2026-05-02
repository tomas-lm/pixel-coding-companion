import { describe, expect, it } from 'vitest'
import { COMPANION_REGISTRY, TOUK_STAGES } from './companionRegistry'

describe('companion registry', () => {
  it('registers Touk in place of Buba with ground and flying stage heights', () => {
    const touk = COMPANION_REGISTRY.find((companion) => companion.id === 'touk')

    expect(COMPANION_REGISTRY.some((companion) => companion.id === 'buba')).toBe(false)
    expect(touk).toMatchObject({
      id: 'touk',
      name: 'Touk',
      rarity: 'uncommon'
    })
    expect(touk?.stages).toBe(TOUK_STAGES)
    expect(
      touk?.stages.map((stage) => ({
        height: stage.height,
        id: stage.id,
        offsetY: stage.offsetY ?? 0
      }))
    ).toEqual([
      { height: 149, id: 'egg', offsetY: 0 },
      { height: 149, id: 'lvl1', offsetY: 40 },
      { height: 135, id: 'lvl2', offsetY: 0 },
      { height: 154, id: 'lvl3', offsetY: 0 }
    ])
  })
})
