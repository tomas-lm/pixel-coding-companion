import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { TerminalContextHudSnapshot } from '../../../shared/terminal'
import { TerminalContextHud } from './TerminalContextHud'

function createSnapshot(
  overrides: Partial<TerminalContextHudSnapshot> = {}
): TerminalContextHudSnapshot {
  return {
    agent: 'codex',
    contextUsedPercent: 70.7,
    model: 'gpt-5.2',
    reasoningEffort: 'high',
    status: 'filling',
    terminalSessionId: 'terminal-1',
    updatedAt: '2026-05-03T12:00:00Z',
    ...overrides
  }
}

describe('TerminalContextHud', () => {
  afterEach(() => {
    cleanup()
  })

  it('does not render for non-Codex terminals without telemetry', () => {
    const { container } = render(<TerminalContextHud isCodexCandidate={false} snapshot={null} />)

    expect(container).toBeEmptyDOMElement()
  })

  it('renders the waiting state for Codex candidates before rollout telemetry arrives', () => {
    render(<TerminalContextHud isCodexCandidate={true} snapshot={null} />)

    expect(screen.getByLabelText('Codex context')).toBeInTheDocument()
    expect(screen.getByText('Codex')).toBeInTheDocument()
    expect(screen.getByText('Context --')).toBeInTheDocument()
    expect(screen.getByText('Waiting')).toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })

  it('renders model, reasoning effort, context percent, and progressbar semantics', () => {
    render(<TerminalContextHud isCodexCandidate={true} snapshot={createSnapshot()} />)

    expect(screen.getByText('Codex')).toBeInTheDocument()
    expect(screen.getByText('gpt-5.2')).toBeInTheDocument()
    expect(screen.getByText('high')).toBeInTheDocument()
    expect(screen.getByText('Context 71%')).toBeInTheDocument()
    expect(screen.getByText('Filling')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Context 71%' })).toHaveAttribute(
      'aria-valuenow',
      '71'
    )
  })
})
