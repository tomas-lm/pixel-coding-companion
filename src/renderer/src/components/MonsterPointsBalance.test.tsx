import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MonsterPointsBalance } from './MonsterPointsBalance'

describe('MonsterPointsBalance', () => {
  it('renders formatted monster points', () => {
    render(<MonsterPointsBalance monsterPoints={125000} />)

    expect(screen.getByLabelText('Monster Points balance')).toHaveTextContent('MP125,000')
  })
})
