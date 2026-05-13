import { fireEvent, render, within } from '@testing-library/react'
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

  it('renders Raya evolved stages 30 percent smaller only in the companion store card', () => {
    const raya = COMPANION_REGISTRY.find((companion) => companion.id === 'raya')

    if (!raya) throw new Error('Raya companion was not registered.')

    const avatar = renderStoreCard('raya', 50)

    expect(raya.stages[3].avatarScale).toBeUndefined()
    expect(avatar?.style.getPropertyValue('--companion-avatar-scale')).toBe('0.7')
  })

  it('renders the Raya egg 30 percent larger than the scaled Raya store size', () => {
    const raya = COMPANION_REGISTRY.find((companion) => companion.id === 'raya')

    if (!raya) throw new Error('Raya companion was not registered.')

    const avatar = renderStoreCard('raya', 0)

    expect(raya.stages[0].avatarScale).toBeUndefined()
    expect(avatar?.style.getPropertyValue('--companion-avatar-scale')).toBe('0.91')
  })

  it('nudges the Raya egg right only in the companion store card', () => {
    const raya = COMPANION_REGISTRY.find((companion) => companion.id === 'raya')

    if (!raya) throw new Error('Raya companion was not registered.')

    const avatar = renderStoreCard('raya', 0)

    expect(raya.stages[0].avatarOffsetX).toBe(-4)
    expect(avatar?.style.getPropertyValue('--companion-avatar-offset-x')).toBe('0px')
  })

  it('nudges Raya evolved stages left only in the companion store card', () => {
    const raya = COMPANION_REGISTRY.find((companion) => companion.id === 'raya')

    if (!raya) throw new Error('Raya companion was not registered.')

    const level1Avatar = renderStoreCard('raya', 5)
    const level2Avatar = renderStoreCard('raya', 25)
    const level3Avatar = renderStoreCard('raya', 50)

    expect(raya.stages[1].avatarOffsetX).toBeUndefined()
    expect(raya.stages[2].avatarOffsetX).toBeUndefined()
    expect(raya.stages[3].avatarOffsetX).toBeUndefined()
    expect(level1Avatar?.style.getPropertyValue('--companion-avatar-offset-x')).toBe('-24px')
    expect(level2Avatar?.style.getPropertyValue('--companion-avatar-offset-x')).toBe('-24px')
    expect(level3Avatar?.style.getPropertyValue('--companion-avatar-offset-x')).toBe('-24px')
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

  it('renders Karpa level 1 and level 2 smaller only in the companion store card', () => {
    const karpa = COMPANION_REGISTRY.find((companion) => companion.id === 'karpa')

    if (!karpa) throw new Error('Karpa companion was not registered.')

    const level1Avatar = renderStoreCard('karpa', 5)
    const level2Avatar = renderStoreCard('karpa', 25)
    const level3Avatar = renderStoreCard('karpa', 50)

    expect(karpa.stages[1].avatarScale).toBeUndefined()
    expect(karpa.stages[2].avatarScale).toBeUndefined()
    expect(karpa.stages[3].avatarScale).toBeUndefined()
    expect(karpa.stages[1].avatarOffsetX).toBeUndefined()
    expect(karpa.stages[2].avatarOffsetX).toBeUndefined()
    expect(level1Avatar?.style.getPropertyValue('--companion-avatar-scale')).toBe('0.7')
    expect(level2Avatar?.style.getPropertyValue('--companion-avatar-scale')).toBe('0.7')
    expect(level3Avatar?.style.getPropertyValue('--companion-avatar-scale')).toBe('1')
    expect(level1Avatar?.style.getPropertyValue('--companion-avatar-offset-x')).toBe('-45px')
    expect(level2Avatar?.style.getPropertyValue('--companion-avatar-offset-x')).toBe('-45px')
  })

  it('sets Karpa level 2 and level 3 to the egg floor height only in the companion store card', () => {
    const karpa = COMPANION_REGISTRY.find((companion) => companion.id === 'karpa')

    if (!karpa) throw new Error('Karpa companion was not registered.')

    const eggAvatar = renderStoreCard('karpa', 0)
    const level2Avatar = renderStoreCard('karpa', 25)
    const level3Avatar = renderStoreCard('karpa', 50)

    expect(karpa.stages[2].avatarOffsetY).toBeUndefined()
    expect(karpa.stages[3].avatarOffsetY).toBeUndefined()
    expect(eggAvatar?.style.getPropertyValue('--companion-avatar-offset-y')).toBe('10px')
    expect(level2Avatar?.style.getPropertyValue('--companion-avatar-offset-y')).toBe('10px')
    expect(level3Avatar?.style.getPropertyValue('--companion-avatar-offset-y')).toBe('10px')
  })

  it('shows the dev level up button for owned companions without selecting the card', () => {
    const karpa = COMPANION_REGISTRY.find((companion) => companion.id === 'karpa')
    const onLevelDown = vi.fn()
    const onLevelUp = vi.fn()
    const onSelect = vi.fn()

    if (!karpa) throw new Error('Karpa companion was not registered.')

    const { container } = render(
      <CompanionStoreCard
        companion={karpa}
        isDevLevelUpEnabled
        onLevelDown={onLevelDown}
        onLevelUp={onLevelUp}
        onSelect={onSelect}
        state={{
          currentXp: 0,
          level: 0,
          monsterPoints: 0,
          owned: true,
          selected: true,
          totalXp: 0
        }}
      />
    )
    const renderedCard = within(container)

    fireEvent.click(renderedCard.getByRole('button', { name: 'Level up Karpa' }))

    expect(onLevelUp).toHaveBeenCalledWith(karpa)
    expect(renderedCard.getByRole('button', { name: 'Level down Karpa' })).toBeDisabled()
    expect(onLevelDown).not.toHaveBeenCalled()
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('shows the dev level down button for owned companions without selecting the card', () => {
    const karpa = COMPANION_REGISTRY.find((companion) => companion.id === 'karpa')
    const onLevelDown = vi.fn()
    const onSelect = vi.fn()

    if (!karpa) throw new Error('Karpa companion was not registered.')

    const { container } = render(
      <CompanionStoreCard
        companion={karpa}
        isDevLevelUpEnabled
        onLevelDown={onLevelDown}
        onSelect={onSelect}
        state={{
          currentXp: 0,
          level: 5,
          monsterPoints: 0,
          owned: true,
          selected: true,
          totalXp: 0
        }}
      />
    )
    const renderedCard = within(container)

    fireEvent.click(renderedCard.getByRole('button', { name: 'Level down Karpa' }))

    expect(onLevelDown).toHaveBeenCalledWith(karpa)
    expect(onSelect).not.toHaveBeenCalled()
  })
})
