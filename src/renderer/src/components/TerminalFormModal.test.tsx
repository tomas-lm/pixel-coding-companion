import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TerminalFormModal } from './TerminalFormModal'

describe('TerminalFormModal', () => {
  it('renders configure terminal mode with delete action', () => {
    render(
      <TerminalFormModal
        form={{
          commandsText: 'pnpm dev',
          cwd: '/repo',
          id: 'terminal-1',
          kind: 'ai',
          name: 'Assistant'
        }}
        onChange={vi.fn()}
        onClose={vi.fn()}
        onDelete={vi.fn()}
        onPickFolder={vi.fn()}
        onSave={vi.fn()}
      />
    )

    expect(screen.getByRole('heading', { name: 'Configure terminal' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Choose folder' })).toBeInTheDocument()
    expect(screen.getByDisplayValue('Assistant')).toBeInTheDocument()
  })
})
