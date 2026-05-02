import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ProjectFormModal } from './ProjectFormModal'

describe('ProjectFormModal', () => {
  it('renders add workspace mode', () => {
    render(
      <ProjectFormModal
        form={{ color: '#4ea1ff', description: '', name: '' }}
        onChange={vi.fn()}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    )

    expect(screen.getByRole('heading', { name: 'Add workspace' })).toBeInTheDocument()
    expect(screen.getByLabelText('Close workspace settings')).toBeInTheDocument()
  })
})
