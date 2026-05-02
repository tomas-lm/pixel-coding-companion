import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AddButton, IconOnlyButton, RowActionButton } from './IconButtons'

describe('icon buttons', () => {
  it('renders accessible icon-only buttons with title fallback', () => {
    render(<IconOnlyButton label="Stop session">x</IconOnlyButton>)

    expect(screen.getByRole('button', { name: 'Stop session' })).toHaveAttribute(
      'title',
      'Stop session'
    )
  })

  it('renders add and row action button classes', () => {
    render(
      <>
        <AddButton label="Add project" />
        <RowActionButton label="Edit project">Edit</RowActionButton>
      </>
    )

    expect(screen.getByRole('button', { name: 'Add project' })).toHaveClass('add-button')
    expect(screen.getByRole('button', { name: 'Edit project' })).toHaveClass('row-action-button')
  })
})
