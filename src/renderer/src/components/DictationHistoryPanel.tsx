import type { DictationHistoryEntry, DictationStatsSnapshot } from '../../../shared/dictation'

type DictationHistoryPanelProps = {
  entries: DictationHistoryEntry[]
  query: string
  stats: DictationStatsSnapshot | null
  onChangeQuery: (query: string) => void
  onClearHistory: () => void
  onCopyEntry: (entry: DictationHistoryEntry) => void
  onDeleteEntry: (entry: DictationHistoryEntry) => void
}

function formatDuration(durationMs: number): string {
  if (durationMs < 1000) return `${Math.round(durationMs)}ms`

  const seconds = Math.round(durationMs / 1000)
  if (seconds < 60) return `${seconds}s`

  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}m ${remainingSeconds}s`
}

function formatDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleString(undefined, {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short'
  })
}

export function DictationHistoryPanel({
  entries,
  query,
  stats,
  onChangeQuery,
  onClearHistory,
  onCopyEntry,
  onDeleteEntry
}: DictationHistoryPanelProps): React.JSX.Element {
  const visibleStats = stats ?? {
    audioStorageBytes: 0,
    averageWordsPerTranscript: 0,
    estimatedKeystrokesAvoided: 0,
    totalDurationMs: 0,
    totalTranscripts: 0,
    totalWordsDictated: 0,
    updatedAt: '',
    wordsDictatedToday: 0
  }

  return (
    <section className="dictation-history-panel" aria-label="Dictation history">
      <header className="dictation-history-panel__header">
        <div>
          <h1>Dictation History</h1>
          <p>Past local transcripts.</p>
        </div>
        <button
          className="secondary-button"
          type="button"
          disabled={entries.length === 0}
          onClick={onClearHistory}
        >
          Clear
        </button>
      </header>

      <div className="dictation-history-panel__toolbar">
        <input
          type="search"
          aria-label="Search dictation history"
          placeholder="Search transcripts"
          value={query}
          onChange={(event) => onChangeQuery(event.currentTarget.value)}
        />
      </div>

      <section className="dictation-history-productivity" aria-labelledby="dictation-history-stats">
        <h2 id="dictation-history-stats">Productivity</h2>
        <div className="dictation-stats-grid" aria-label="Dictation productivity stats">
          <div className="dictation-stat">
            <span>Today</span>
            <strong>{visibleStats.wordsDictatedToday.toLocaleString()}</strong>
            <small>words dictated</small>
          </div>
          <div className="dictation-stat">
            <span>Total</span>
            <strong>{visibleStats.totalWordsDictated.toLocaleString()}</strong>
            <small>words dictated</small>
          </div>
          <div className="dictation-stat">
            <span>Avoided</span>
            <strong>{visibleStats.estimatedKeystrokesAvoided.toLocaleString()}</strong>
            <small>keystrokes</small>
          </div>
          <div className="dictation-stat">
            <span>Duration</span>
            <strong>{formatDuration(visibleStats.totalDurationMs)}</strong>
            <small>{visibleStats.totalTranscripts.toLocaleString()} transcripts</small>
          </div>
        </div>
      </section>

      <div className="dictation-history-panel__list app-dark-scroll" aria-label="Past transcripts">
        {entries.length > 0 ? (
          entries.map((entry) => (
            <article key={entry.id} className="dictation-history-card">
              <button
                className="dictation-history-card__text"
                type="button"
                onClick={() => onCopyEntry(entry)}
              >
                {entry.text}
              </button>
              <div className="dictation-history-card__meta">
                <span>{formatDateTime(entry.createdAt)}</span>
                <span>{entry.wordCount} words</span>
                <span>{formatDuration(entry.durationMs)}</span>
              </div>
              <div className="dictation-history-card__actions">
                <button className="primary-button" type="button" onClick={() => onCopyEntry(entry)}>
                  Copy
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => onDeleteEntry(entry)}
                >
                  Delete
                </button>
              </div>
            </article>
          ))
        ) : (
          <div className="dictation-history-empty">
            {query.trim()
              ? 'No saved transcripts match this search.'
              : 'Saved transcripts will appear here after local dictation runs.'}
          </div>
        )}
      </div>
    </section>
  )
}
