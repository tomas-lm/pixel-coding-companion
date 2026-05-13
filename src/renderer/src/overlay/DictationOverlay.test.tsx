import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CompanionApi } from '../../../shared/terminal'
import { DictationOverlay } from './DictationOverlay'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function stubApi(): { api: CompanionApi; writeText: ReturnType<typeof vi.fn> } {
  const writeText = vi.fn()
  const api = {
    clipboard: {
      writeText
    },
    dictation: {
      loadSnapshot: vi.fn().mockResolvedValue({
        backend: {
          available: true,
          id: 'mock',
          label: 'Mock',
          ready: true,
          status: 'ready'
        },
        lastTranscript: {
          backend: 'mock',
          durationMs: 1200,
          text: 'copy this transcript'
        },
        model: {
          downloadedBytes: 0,
          percent: 0,
          requiredBytesLabel: '~461 MB',
          sourceUrl: 'https://example.com',
          status: 'installed',
          totalBytes: 0
        },
        settings: {
          enabled: true,
          keepAudioHistory: false,
          keepLastAudioSample: false,
          keepTranscriptHistory: true,
          overlayEnabled: true,
          shortcutId: 'control-option-hold'
        },
        shortcut: 'Control+Option',
        state: 'idle'
      }),
      onState: vi.fn().mockReturnValue(() => {}),
      finishOverlayDrag: vi.fn(),
      openAudioSettings: vi.fn(),
      openMainWindow: vi.fn(),
      moveOverlay: vi.fn(),
      setOverlayExpanded: vi.fn(),
      toggleRecording: vi.fn().mockResolvedValue({
        backend: {
          available: true,
          id: 'mock',
          label: 'Mock',
          ready: true,
          status: 'ready'
        },
        model: {
          downloadedBytes: 0,
          percent: 0,
          requiredBytesLabel: '~461 MB',
          sourceUrl: 'https://example.com',
          status: 'installed',
          totalBytes: 0
        },
        settings: {
          enabled: true,
          keepAudioHistory: false,
          keepLastAudioSample: false,
          keepTranscriptHistory: true,
          overlayEnabled: true,
          shortcutId: 'control-option-hold'
        },
        shortcut: 'Control+Option',
        state: 'recording'
      })
    }
  } as unknown as CompanionApi

  vi.stubGlobal('window', Object.assign(window, { api }))
  return { api, writeText }
}

describe('DictationOverlay', () => {
  it('copies the latest transcript', async () => {
    const { writeText } = stubApi()

    render(<DictationOverlay />)

    fireEvent.click(screen.getByRole('button', { name: 'Open dictation overlay' }))
    const copyButton = await screen.findByRole('button', { name: 'Copy latest transcript' })

    expect(screen.queryByText('copy this transcript')).not.toBeInTheDocument()
    fireEvent.click(copyButton)

    expect(writeText).toHaveBeenCalledWith('copy this transcript')
    await waitFor(() => expect(copyButton).toHaveAttribute('title', 'Copied'))
  })

  it('opens Pixel only from the explicit Pixel action', async () => {
    const { api } = stubApi()

    render(<DictationOverlay />)

    fireEvent.click(screen.getByRole('button', { name: 'Open dictation overlay' }))

    expect(api.dictation.setOverlayExpanded).toHaveBeenCalledWith(true)
    expect(api.dictation.openMainWindow).not.toHaveBeenCalled()

    fireEvent.click(await screen.findByRole('button', { name: 'Go to Pixel' }))

    expect(api.dictation.setOverlayExpanded).toHaveBeenCalledWith(false)
    expect(api.dictation.openMainWindow).toHaveBeenCalled()
  })

  it('collapses the expanded overlay from the close action', async () => {
    const { api } = stubApi()

    render(<DictationOverlay />)

    fireEvent.click(screen.getByRole('button', { name: 'Open dictation overlay' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Close window' }))

    expect(api.dictation.setOverlayExpanded).toHaveBeenCalledWith(true)
    expect(api.dictation.setOverlayExpanded).toHaveBeenCalledWith(false)
    expect(screen.getByRole('button', { name: 'Open dictation overlay' })).toBeInTheDocument()
  })

  it('moves the compact overlay by dragging the orb', () => {
    const { api } = stubApi()

    render(<DictationOverlay />)

    const orb = screen.getByRole('button', { name: 'Open dictation overlay' })
    fireEvent.pointerDown(orb, { button: 0, pointerId: 1, screenX: 100, screenY: 100 })
    fireEvent.pointerMove(orb, { pointerId: 1, screenX: 116, screenY: 108 })
    fireEvent.pointerUp(orb, { pointerId: 1, screenX: 116, screenY: 108 })
    fireEvent.click(orb)

    expect(api.dictation.moveOverlay).toHaveBeenCalledWith({ deltaX: 16, deltaY: 8 })
    expect(api.dictation.finishOverlayDrag).toHaveBeenCalledOnce()
    expect(api.dictation.setOverlayExpanded).not.toHaveBeenCalled()
  })
})
