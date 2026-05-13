import { useEffect, useState } from 'react'
import type { DictationSnapshot } from '../../../shared/dictation'

function getStateLabel(snapshot: DictationSnapshot | null): string {
  if (!snapshot) return 'Loading'
  if (snapshot.state === 'recording') return 'Recording'
  if (snapshot.state === 'transcribing') return 'Transcribing'
  if (snapshot.state === 'inserting') return 'Inserting'
  if (snapshot.state === 'error') return 'Needs attention'

  return snapshot.lastTranscript ? 'Ready to copy' : 'Ready'
}

export function DictationOverlay(): React.JSX.Element {
  const [snapshot, setSnapshot] = useState<DictationSnapshot | null>(null)
  const [copied, setCopied] = useState(false)
  const transcriptText = snapshot?.lastTranscript?.text ?? ''
  const canCopy = transcriptText.trim().length > 0

  useEffect(() => {
    let mounted = true

    void window.api.dictation.loadSnapshot().then((nextSnapshot) => {
      if (mounted) setSnapshot(nextSnapshot)
    })
    const unsubscribe = window.api.dictation.onState((nextSnapshot) => {
      setSnapshot(nextSnapshot)
      setCopied(false)
    })

    return () => {
      mounted = false
      unsubscribe()
    }
  }, [])

  const copyTranscript = (): void => {
    if (!canCopy) return

    window.api.clipboard.writeText(transcriptText)
    setCopied(true)
  }

  return (
    <main className={`dictation-overlay dictation-overlay--${snapshot?.state ?? 'idle'}`}>
      <div className="dictation-overlay__status" aria-hidden="true" />
      <div className="dictation-overlay__content">
        <strong>{getStateLabel(snapshot)}</strong>
        <span>
          {snapshot?.state === 'error'
            ? (snapshot.error ?? 'Dictation failed.')
            : transcriptText || 'Hold your dictation bind to start.'}
        </span>
      </div>
      <div className="dictation-overlay__actions">
        <button type="button" disabled={!canCopy} onClick={copyTranscript}>
          {copied ? 'Copied' : 'Copy'}
        </button>
        <button type="button" onClick={window.api.dictation.openAudioSettings}>
          Audio
        </button>
      </div>
    </main>
  )
}
