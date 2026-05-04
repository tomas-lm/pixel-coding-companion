import { describe, expect, it } from 'vitest'
import { COMPANION_REGISTRY, KARPA_STAGES, TATA_STAGES, TOUK_STAGES } from './companionRegistry'

describe('companion registry', () => {
  it('keeps marketplace companions ordered by rarity tier', () => {
    expect(
      COMPANION_REGISTRY.filter((companion) => companion.rarity !== 'starter').map((companion) => ({
        id: companion.id,
        rarity: companion.rarity
      }))
    ).toEqual([
      { id: 'raya', rarity: 'common' },
      { id: 'karpa', rarity: 'uncommon' },
      { id: 'tata', rarity: 'uncommon' },
      { id: 'drago', rarity: 'rare' },
      { id: 'touk', rarity: 'ultra_rare' },
      { id: 'phoebe', rarity: 'legendary' },
      { id: 'corax', rarity: 'special' }
    ])
  })

  it('registers Touk in place of Buba with ground and flying stage heights', () => {
    const touk = COMPANION_REGISTRY.find((companion) => companion.id === 'touk')

    expect(COMPANION_REGISTRY.some((companion) => companion.id === 'buba')).toBe(false)
    expect(touk).toMatchObject({
      id: 'touk',
      name: 'Touk',
      rarity: 'ultra_rare'
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

  it('registers Karpa with all four idle evolutions', () => {
    const karpa = COMPANION_REGISTRY.find((companion) => companion.id === 'karpa')

    expect(karpa).toMatchObject({
      id: 'karpa',
      name: 'Karpa',
      rarity: 'uncommon'
    })
    expect(karpa?.stages).toBe(KARPA_STAGES)
    expect(karpa?.stages.map((stage) => stage.id)).toEqual(['egg', 'lvl1', 'lvl2', 'lvl3'])
    expect(
      karpa?.stages.map((stage) => ({
        id: stage.id,
        offsetX: stage.offsetX ?? 0,
        offsetY: stage.offsetY ?? 0
      }))
    ).toEqual([
      { id: 'egg', offsetX: 0, offsetY: 0 },
      { id: 'lvl1', offsetX: 0, offsetY: 0 },
      { id: 'lvl2', offsetX: 0, offsetY: 40 },
      { id: 'lvl3', offsetX: 0, offsetY: 40 }
    ])
  })

  it('keeps Tata monster evolutions grounded like Frogo', () => {
    const tata = COMPANION_REGISTRY.find((companion) => companion.id === 'tata')

    expect(tata?.stages).toBe(TATA_STAGES)
    expect(
      tata?.stages.map((stage) => ({
        id: stage.id,
        offsetY: stage.offsetY ?? 0
      }))
    ).toEqual([
      { id: 'egg', offsetY: 0 },
      { id: 'lvl1', offsetY: 40 },
      { id: 'lvl2', offsetY: 40 },
      { id: 'lvl3', offsetY: 40 }
    ])
  })
})
