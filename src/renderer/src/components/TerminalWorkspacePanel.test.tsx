import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_TERMINAL_THEME_ID } from '../../../shared/workspace'
import { TerminalWorkspacePanel } from './TerminalWorkspacePanel'

vi.mock('./TerminalPane', () => ({
  TerminalPane: () => <div data-testid="terminal-pane" />
}))

describe('TerminalWorkspacePanel', () => {
  it('renders empty state for a workspace without configured terminals', () => {
    render(
      <TerminalWorkspacePanel
        activeProject={{ color: '#4ea1ff', description: '', id: 'project-1', name: 'Pixel' }}
        activeProjectConfigs={[]}
        activeSession={null}
        onCreateProject={vi.fn()}
        onCreateTerminal={vi.fn()}
        onOpenPromptPicker={vi.fn()}
        onSessionActivity={vi.fn()}
        onSessionStartError={vi.fn()}
        onSessionStarted={vi.fn()}
        onStartWorkspace={vi.fn()}
        runningSessions={[]}
        selectedSessionId={null}
        sessionSummary="0 configured terminals - No description"
        terminalThemeId={DEFAULT_TERMINAL_THEME_ID}
        terminalTitle="Workspace"
      />
    )

    expect(screen.getByRole('heading', { name: 'Workspace' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Use prompt' })).toBeInTheDocument()
    expect(screen.queryByText('Ready')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add terminal' })).toBeInTheDocument()
  })
})
