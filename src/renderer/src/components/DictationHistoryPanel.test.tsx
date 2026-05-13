import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DictationHistoryEntry, DictationStatsSnapshot } from '../../../shared/dictation'
import { DictationHistoryPanel } from './DictationHistoryPanel'

afterEach(cleanup)

const entry: DictationHistoryEntry = {
  backend: 'macos-parakeet-coreml',
  characterCount: 18,
  createdAt: '2026-05-13T12:00:00.000Z',
  durationMs: 1400,
  estimatedKeystrokesAvoided: 18,
  id: 'transcript-1',
  text: 'copy this sentence',
  wordCount: 3
}

const stats: DictationStatsSnapshot = {
  audioStorageBytes: 0,
  averageWordsPerTranscript: 3,
  estimatedKeystrokesAvoided: 48,
  totalDurationMs: 4200,
  totalTranscripts: 2,
  totalWordsDictated: 8,
  updatedAt: '2026-05-13T12:00:00.000Z',
  wordsDictatedToday: 5
}

describe('DictationHistoryPanel', () => {
  it('copies a previous transcript', () => {
    const onCopyEntry = vi.fn()

    render(
      <DictationHistoryPanel
        entries={[entry]}
        query=""
        stats={stats}
        onChangeQuery={vi.fn()}
        onClearHistory={vi.fn()}
        onCopyEntry={onCopyEntry}
        onDeleteEntry={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }))

    expect(onCopyEntry).toHaveBeenCalledWith(entry)
  })

  it('updates the history search query', () => {
    const onChangeQuery = vi.fn()

    render(
      <DictationHistoryPanel
        entries={[entry]}
        query=""
        stats={stats}
        onChangeQuery={onChangeQuery}
        onClearHistory={vi.fn()}
        onCopyEntry={vi.fn()}
        onDeleteEntry={vi.fn()}
      />
    )

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search dictation history' }), {
      target: { value: 'sentence' }
    })

    expect(onChangeQuery).toHaveBeenCalledWith('sentence')
  })

  it('shows dictation productivity stats above the transcript list', () => {
    render(
      <DictationHistoryPanel
        entries={[entry]}
        query=""
        stats={stats}
        onChangeQuery={vi.fn()}
        onClearHistory={vi.fn()}
        onCopyEntry={vi.fn()}
        onDeleteEntry={vi.fn()}
      />
    )

    expect(screen.getByRole('heading', { name: 'Productivity' })).toBeInTheDocument()
    expect(screen.getByText('48')).toBeInTheDocument()
    expect(screen.getByText('keystrokes')).toBeInTheDocument()
  })
})
