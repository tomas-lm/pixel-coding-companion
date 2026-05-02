import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { COMPANION_REGISTRY } from '../companions/companionRegistry'
import { CompanionStoreCard } from './CompanionStoreCard'

describe('CompanionStoreCard', () => {
  it('renders the Touk egg smaller only in the companion store card', () => {
    const touk = COMPANION_REGISTRY.find((companion) => companion.id === 'touk')

    if (!touk) throw new Error('Touk companion was not registered.')

    const { container } = render(
      <CompanionStoreCard
        companion={touk}
        onSelect={vi.fn()}
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
    const avatar = container.querySelector<HTMLElement>('.companion-store-card-avatar')

    expect(touk.stages[0].avatarScale).toBeUndefined()
    expect(avatar?.style.getPropertyValue('--companion-avatar-scale')).toBe('0.9')
  })
})
