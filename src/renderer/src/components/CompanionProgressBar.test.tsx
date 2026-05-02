import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createCompanionProgressSnapshot } from '../lib/companionProgress'
import { CompanionProgressBar } from './CompanionProgressBar'

describe('CompanionProgressBar', () => {
  it('renders companion level and XP progress accessibly', () => {
    const progress = createCompanionProgressSnapshot({
      currentXp: 60,
      level: 0,
      name: 'Frogo',
      totalXp: 60
    })

    render(<CompanionProgressBar progress={progress} />)

    expect(screen.getByRole('progressbar', { name: '60 of 120 XP' })).toHaveAttribute(
      'aria-valuenow',
      '60'
    )
    expect(screen.getByText('Frogo')).toBeInTheDocument()
    expect(screen.getByText('Lvl 0')).toBeInTheDocument()
    expect(screen.getByText('60/120 XP')).toBeInTheDocument()
  })
})
