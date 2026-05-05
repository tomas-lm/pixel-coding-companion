import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProjectFormModal } from './ProjectFormModal'

afterEach(cleanup)

describe('ProjectFormModal', () => {
  it('renders add workspace mode', () => {
    render(
      <ProjectFormModal
        form={{
          changeRoots: [],
          color: '#4ea1ff',
          defaultFolder: '',
          description: '',
          name: ''
        }}
        onChange={vi.fn()}
        onClose={vi.fn()}
        onPickDefaultFolder={vi.fn()}
        onPickChangeRoot={vi.fn()}
        onSave={vi.fn()}
      />
    )

    expect(screen.getByRole('heading', { name: 'Add workspace' })).toBeInTheDocument()
    expect(screen.getByLabelText('Close workspace settings')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Choose default folder' })).toBeInTheDocument()
    expect(screen.getByText('No change roots configured.')).toBeInTheDocument()
  })

  it('adds a picked change root', async () => {
    const onChange = vi.fn()

    render(
      <ProjectFormModal
        form={{
          changeRoots: [],
          color: '#4ea1ff',
          defaultFolder: '',
          description: '',
          name: 'Pixel'
        }}
        onChange={onChange}
        onClose={vi.fn()}
        onPickDefaultFolder={vi.fn()}
        onPickChangeRoot={vi.fn(() => Promise.resolve({ name: 'pixel', path: '/repo/pixel' }))}
        onSave={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Add folder' }))

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith({
        changeRoots: [
          {
            id: expect.stringMatching(/^change-root-/),
            label: 'pixel',
            path: '/repo/pixel'
          }
        ],
        color: '#4ea1ff',
        defaultFolder: '',
        description: '',
        name: 'Pixel'
      })
    })
  })

  it('removes a configured change root', () => {
    const onChange = vi.fn()

    render(
      <ProjectFormModal
        form={{
          changeRoots: [{ id: 'root-1', label: 'pixel', path: '/repo/pixel' }],
          color: '#4ea1ff',
          defaultFolder: '',
          description: '',
          name: 'Pixel'
        }}
        onChange={onChange}
        onClose={vi.fn()}
        onPickDefaultFolder={vi.fn()}
        onPickChangeRoot={vi.fn()}
        onSave={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))

    expect(onChange).toHaveBeenCalledWith({
      changeRoots: [],
      color: '#4ea1ff',
      defaultFolder: '',
      description: '',
      name: 'Pixel'
    })
  })
})
