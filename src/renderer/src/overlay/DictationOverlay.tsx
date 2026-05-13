import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react'
import type { DictationSnapshot } from '../../../shared/dictation'

const DRAG_CLICK_THRESHOLD_PX = 4

type OverlayDragState = {
  lastScreenX: number
  lastScreenY: number
  pointerId: number
  totalDistance: number
}

type OverlayIconName = 'close' | 'copy' | 'pixel'

function OverlayIcon({ name }: { name: OverlayIconName }): React.JSX.Element {
  if (name === 'pixel') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M3 12l9-8 9 8" />
        <path d="M5 10.5v8.5h5v-5h4v5h5v-8.5" />
      </svg>
    )
  }

  if (name === 'copy') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <rect x="8" y="8" width="11" height="11" rx="2" />
        <path d="M5 15h-.5a2 2 0 0 1-2-2v-8.5a2 2 0 0 1 2-2h8.5a2 2 0 0 1 2 2v.5" />
      </svg>
    )
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  )
}

export function DictationOverlay(): React.JSX.Element {
  const [snapshot, setSnapshot] = useState<DictationSnapshot | null>(null)
  const [copied, setCopied] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const compactDragRef = useRef<OverlayDragState | null>(null)
  const suppressNextCompactClickRef = useRef(false)
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

  const setOverlayExpanded = (nextExpanded: boolean): void => {
    setExpanded(nextExpanded)
    window.api.dictation.setOverlayExpanded(nextExpanded)
  }

  const goToPixel = (): void => {
    setOverlayExpanded(false)
    window.api.dictation.openMainWindow()
  }

  const startCompactDrag = (event: PointerEvent<HTMLButtonElement>): void => {
    if (event.button !== 0) return

    compactDragRef.current = {
      lastScreenX: event.screenX,
      lastScreenY: event.screenY,
      pointerId: event.pointerId,
      totalDistance: 0
    }
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const moveCompactDrag = (event: PointerEvent<HTMLButtonElement>): void => {
    const dragState = compactDragRef.current
    if (!dragState || dragState.pointerId !== event.pointerId) return

    const deltaX = Math.round(event.screenX - dragState.lastScreenX)
    const deltaY = Math.round(event.screenY - dragState.lastScreenY)
    if (deltaX === 0 && deltaY === 0) return

    dragState.lastScreenX = event.screenX
    dragState.lastScreenY = event.screenY
    dragState.totalDistance += Math.hypot(deltaX, deltaY)
    if (dragState.totalDistance > DRAG_CLICK_THRESHOLD_PX) {
      suppressNextCompactClickRef.current = true
    }

    window.api.dictation.moveOverlay({ deltaX, deltaY })
  }

  const stopCompactDrag = (event: PointerEvent<HTMLButtonElement>): void => {
    const dragState = compactDragRef.current
    if (!dragState || dragState.pointerId !== event.pointerId) return

    if (dragState.totalDistance > DRAG_CLICK_THRESHOLD_PX) {
      suppressNextCompactClickRef.current = true
      window.api.dictation.finishOverlayDrag()
    }
    compactDragRef.current = null
    event.currentTarget.releasePointerCapture?.(event.pointerId)
  }

  const openCompactOverlay = (event: MouseEvent<HTMLButtonElement>): void => {
    if (suppressNextCompactClickRef.current) {
      suppressNextCompactClickRef.current = false
      event.preventDefault()
      event.stopPropagation()
      return
    }

    setOverlayExpanded(true)
  }

  if (!expanded) {
    return (
      <main
        className={`dictation-overlay dictation-overlay--compact dictation-overlay--${
          snapshot?.state ?? 'idle'
        }`}
      >
        <button
          className="dictation-overlay__orb"
          type="button"
          aria-label="Open dictation overlay"
          title="Drag to move. Click to expand."
          onClick={openCompactOverlay}
          onPointerCancel={stopCompactDrag}
          onPointerDown={startCompactDrag}
          onPointerMove={moveCompactDrag}
          onPointerUp={stopCompactDrag}
        >
          <span className="dictation-overlay__status" aria-hidden="true" />
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M12 4a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0v-5a3 3 0 0 1 3-3z" />
            <path d="M5 11a7 7 0 0 0 14 0" />
            <path d="M12 18v3" />
            <path d="M9 21h6" />
          </svg>
        </button>
      </main>
    )
  }

  return (
    <main
      className={`dictation-overlay dictation-overlay--expanded dictation-overlay--${
        snapshot?.state ?? 'idle'
      }`}
    >
      <div className="dictation-overlay__menu" role="toolbar" aria-label="Dictation overlay">
        <button
          className="dictation-overlay__menu-button"
          type="button"
          aria-label="Go to Pixel"
          title="Go to Pixel"
          onClick={goToPixel}
        >
          <OverlayIcon name="pixel" />
        </button>
        <button
          className="dictation-overlay__menu-button"
          type="button"
          aria-label="Copy latest transcript"
          title={copied ? 'Copied' : 'Copy latest transcript'}
          disabled={!canCopy}
          onClick={copyTranscript}
        >
          <OverlayIcon name="copy" />
        </button>
        <button
          className="dictation-overlay__menu-button"
          type="button"
          aria-label="Close window"
          title="Close window"
          onClick={() => setOverlayExpanded(false)}
        >
          <OverlayIcon name="close" />
        </button>
      </div>
    </main>
  )
}
