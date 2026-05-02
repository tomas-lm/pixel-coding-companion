import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { StartWorkspaceModal } from './StartWorkspaceModal'

describe('StartWorkspaceModal', () => {
  it('renders terminal selection state', () => {
    render(
      <StartWorkspaceModal
        configs={[
          {
            commands: ['pnpm dev'],
            cwd: '/repo',
            id: 'terminal-1',
            kind: 'ai',
            name: 'Assistant',
            projectId: 'project-1'
          }
        ]}
        liveConfigIds={new Set()}
        onClose={vi.fn()}
        onSelectCategory={vi.fn()}
        onStartSelected={vi.fn()}
        onToggleConfig={vi.fn()}
        onToggleStartWithPixel={vi.fn()}
        project={{ color: '#4ea1ff', description: '', id: 'project-1', name: 'Pixel' }}
        selectedConfigIds={['terminal-1']}
        selectedCount={1}
        selectedPixelConfigCount={1}
        selectedPixelLabel="terminal"
        startWithPixel
      />
    )

    expect(screen.getByRole('heading', { name: 'Start Pixel' })).toBeInTheDocument()
    expect(screen.getByText('Assistant')).toBeInTheDocument()
    expect(screen.getByText('1 selected')).toBeInTheDocument()
  })
})
