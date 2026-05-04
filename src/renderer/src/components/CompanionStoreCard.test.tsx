import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { COMPANION_REGISTRY } from '../companions/companionRegistry'
import { CompanionStoreCard } from './CompanionStoreCard'

describe('CompanionStoreCard', () => {
  function renderStoreCard(companionId: string, level: number): HTMLElement | null {
    const companion = COMPANION_REGISTRY.find((registeredCompanion) => {
      return registeredCompanion.id === companionId
    })

    if (!companion) throw new Error(`${companionId} companion was not registered.`)

    const { container } = render(
      <CompanionStoreCard
        companion={companion}
        onSelect={vi.fn()}
        state={{
          currentXp: 0,
          level,
          monsterPoints: 0,
          owned: true,
          selected: true,
          totalXp: 0
        }}
      />
    )

    return container.querySelector<HTMLElement>('.companion-store-card-avatar')
  }

  it('renders the Touk egg smaller only in the companion store card', () => {
    const touk = COMPANION_REGISTRY.find((companion) => companion.id === 'touk')

    if (!touk) throw new Error('Touk companion was not registered.')

    const avatar = renderStoreCard('touk', 0)

    expect(touk.stages[0].avatarScale).toBeUndefined()
    expect(avatar?.style.getPropertyValue('--companion-avatar-scale')).toBe('0.9')
  })

  it('renders the Tata egg smaller only in the companion store card', () => {
    const tata = COMPANION_REGISTRY.find((companion) => companion.id === 'tata')

    if (!tata) throw new Error('Tata companion was not registered.')

    const avatar = renderStoreCard('tata', 0)

    expect(tata.stages[0].avatarScale).toBeUndefined()
    expect(avatar?.style.getPropertyValue('--companion-avatar-scale')).toBe('0.85')
  })

  it('renders the Combot egg slightly smaller only in the companion store card', () => {
    const combot = COMPANION_REGISTRY.find((companion) => companion.id === 'combot')

    if (!combot) throw new Error('Combot companion was not registered.')

    const avatar = renderStoreCard('combot', 0)

    expect(combot.stages[0].avatarScale).toBeUndefined()
    expect(avatar?.style.getPropertyValue('--companion-avatar-scale')).toBe('0.97')
  })

  it('renders Raya 30 percent smaller only in the companion store card', () => {
    const raya = COMPANION_REGISTRY.find((companion) => companion.id === 'raya')

    if (!raya) throw new Error('Raya companion was not registered.')

    const avatar = renderStoreCard('raya', 50)

    expect(raya.stages[3].avatarScale).toBeUndefined()
    expect(avatar?.style.getPropertyValue('--companion-avatar-scale')).toBe('0.7')
  })

  it('nudges Raya level 1 left only in the companion store card', () => {
    const raya = COMPANION_REGISTRY.find((companion) => companion.id === 'raya')

    if (!raya) throw new Error('Raya companion was not registered.')

    const avatar = renderStoreCard('raya', 5)

    expect(raya.stages[1].avatarOffsetX).toBeUndefined()
    expect(avatar?.style.getPropertyValue('--companion-avatar-offset-x')).toBe('-24px')
  })

  it('nudges Frogo level 3 one pixel right only in the companion store card', () => {
    const frogo = COMPANION_REGISTRY.find((companion) => companion.id === 'frogo')

    if (!frogo) throw new Error('Frogo companion was not registered.')

    const avatar = renderStoreCard('frogo', 50)

    expect(frogo.stages[3].avatarOffsetX).toBe(-9)
    expect(avatar?.style.getPropertyValue('--companion-avatar-offset-x')).toBe('-8px')
  })

  it('nudges the Ghou egg right only in the companion store card', () => {
    const ghou = COMPANION_REGISTRY.find((companion) => companion.id === 'ghou')

    if (!ghou) throw new Error('Ghou companion was not registered.')

    const avatar = renderStoreCard('ghou', 0)

    expect(ghou.stages[0].avatarOffsetX).toBe(-6)
    expect(avatar?.style.getPropertyValue('--companion-avatar-offset-x')).toBe('-1px')
  })
})
