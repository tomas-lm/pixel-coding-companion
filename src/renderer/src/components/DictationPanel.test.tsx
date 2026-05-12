import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DictationSnapshot } from '../../../shared/dictation'
import type { WorkspaceFeatureSettings } from '../../../shared/workspace'
import { DictationPanel } from './DictationPanel'

afterEach(cleanup)

const featureSettings: WorkspaceFeatureSettings = {
  keepLastDictationAudioSample: false,
  localTranscriberEnabled: false,
  localTranscriberShortcut: 'control-option-hold',
  playSoundsUponFinishing: false
}

const dictationSnapshot: DictationSnapshot = {
  backend: {
    available: true,
    id: 'mock',
    label: 'Mock local backend',
    ready: true,
    status: 'ready'
  },
  settings: {
    enabled: false,
    keepLastAudioSample: false,
    shortcutId: 'control-option-hold'
  },
  shortcut: 'Control+Option',
  state: 'idle'
}

function renderDictationPanel(
  overrides: Partial<ComponentProps<typeof DictationPanel>> = {}
): ReturnType<typeof render> {
  return render(
    <DictationPanel
      dictationSnapshot={dictationSnapshot}
      featureSettings={featureSettings}
      onChangeFeatureSettings={vi.fn()}
      onDownloadParakeet={vi.fn()}
      onTestDictation={vi.fn()}
      {...overrides}
    />
  )
}

describe('DictationPanel', () => {
  it('renders the dictation tab controls', () => {
    renderDictationPanel()

    expect(screen.getByRole('heading', { name: 'Dictation' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Enable local transcriber' })).not.toBeChecked()
    expect(screen.getByRole('radiogroup', { name: 'Dictation bind' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Download Parakeet (~2.7 GB)' })).toBeInTheDocument()
  })

  it('updates the local transcriber preference', () => {
    const onChangeFeatureSettings = vi.fn()

    renderDictationPanel({ onChangeFeatureSettings })

    fireEvent.click(screen.getByRole('checkbox', { name: 'Enable local transcriber' }))

    expect(onChangeFeatureSettings).toHaveBeenCalledWith({
      keepLastDictationAudioSample: false,
      localTranscriberEnabled: true,
      localTranscriberShortcut: 'control-option-hold',
      playSoundsUponFinishing: false
    })
  })

  it('updates the dictation bind', () => {
    const onChangeFeatureSettings = vi.fn()

    renderDictationPanel({ onChangeFeatureSettings })

    fireEvent.click(screen.getByRole('radio', { name: 'Option+Shift' }))

    expect(onChangeFeatureSettings).toHaveBeenCalledWith({
      keepLastDictationAudioSample: false,
      localTranscriberEnabled: false,
      localTranscriberShortcut: 'option-shift-hold',
      playSoundsUponFinishing: false
    })
  })

  it('opens the Parakeet download with the size warning visible', () => {
    const onDownloadParakeet = vi.fn()

    renderDictationPanel({ onDownloadParakeet })

    fireEvent.click(screen.getByRole('button', { name: 'Download Parakeet (~2.7 GB)' }))

    expect(onDownloadParakeet).toHaveBeenCalledOnce()
    expect(screen.getByText(/Expected Core ML package: ~2.7 GB/)).toBeInTheDocument()
  })

  it('runs the dictation test when enabled and ready', () => {
    const onTestDictation = vi.fn()

    renderDictationPanel({
      featureSettings: {
        ...featureSettings,
        localTranscriberEnabled: true
      },
      onTestDictation
    })

    fireEvent.click(screen.getByRole('button', { name: 'Test transcription' }))

    expect(onTestDictation).toHaveBeenCalledOnce()
  })
})
