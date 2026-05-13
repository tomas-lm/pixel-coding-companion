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
      openAudioSettings: vi.fn()
    }
  } as unknown as CompanionApi

  vi.stubGlobal('window', Object.assign(window, { api }))
  return { api, writeText }
}

describe('DictationOverlay', () => {
  it('copies the latest transcript', async () => {
    const { writeText } = stubApi()

    render(<DictationOverlay />)

    await screen.findByText('copy this transcript')
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }))

    expect(writeText).toHaveBeenCalledWith('copy this transcript')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument())
  })
})
