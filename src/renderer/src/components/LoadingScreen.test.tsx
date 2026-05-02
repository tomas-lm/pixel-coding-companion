import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LoadingScreen } from './LoadingScreen'

describe('LoadingScreen', () => {
  it('renders a labelled loading panel', () => {
    render(<LoadingScreen label="Loading setup" title="Loading workspace config" />)

    expect(screen.getByLabelText('Loading setup')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Loading workspace config' })).toBeInTheDocument()
  })
})
