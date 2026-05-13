import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DictationSnapshot } from '../../../shared/dictation'
import type { WorkspaceFeatureSettings } from '../../../shared/workspace'
import { DictationPanel } from './DictationPanel'

afterEach(cleanup)

const featureSettings: WorkspaceFeatureSettings = {
  dictationOverlayEnabled: false,
  keepDictationAudioHistory: false,
  keepDictationTranscriptHistory: true,
  keepLastDictationAudioSample: false,
  localTranscriberAudioInputDeviceId: null,
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
    keepAudioHistory: false,
    keepLastAudioSample: false,
    keepTranscriptHistory: true,
    overlayEnabled: false,
    shortcutId: 'control-option-hold'
  },
  model: {
    downloadedBytes: 0,
    percent: 0,
    requiredBytesLabel: '~461 MB',
    sourceUrl: 'https://huggingface.co/FluidInference/parakeet-tdt-0.6b-v3-coreml',
    status: 'not_installed',
    totalBytes: 0
  },
  shortcut: 'Control+Option',
  state: 'idle'
}

function renderDictationPanel(
  overrides: Partial<ComponentProps<typeof DictationPanel>> = {}
): ReturnType<typeof render> {
  return render(
    <DictationPanel
      audioInputDevices={[
        {
          deviceId: 'default',
          isDefault: true,
          label: 'Default - MacBook Air Microphone'
        },
        {
          deviceId: 'macbook-mic',
          isDefault: false,
          label: 'MacBook Air Microphone'
        }
      ]}
      dictationSnapshot={dictationSnapshot}
      featureSettings={featureSettings}
      microphonePermission={{ canPrompt: false, status: 'granted' }}
      onChangeFeatureSettings={vi.fn()}
      onInstallParakeet={vi.fn()}
      onOpenMicrophoneSettings={vi.fn()}
      onRefreshAudioInputs={vi.fn()}
      onRequestMicrophonePermission={vi
        .fn()
        .mockResolvedValue({ canPrompt: false, status: 'granted' })}
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
    expect(screen.getByRole('combobox', { name: 'Dictation microphone' })).toBeInTheDocument()
    expect(screen.getByText('Allowed')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Download Parakeet (~461 MB)' })).toBeInTheDocument()
  })

  it('updates the local transcriber preference', () => {
    const onChangeFeatureSettings = vi.fn()

    renderDictationPanel({ onChangeFeatureSettings })

    fireEvent.click(screen.getByRole('checkbox', { name: 'Enable local transcriber' }))

    expect(onChangeFeatureSettings).toHaveBeenCalledWith({
      ...featureSettings,
      localTranscriberEnabled: true
    })
  })

  it('requests microphone permission from the dictation tab', () => {
    const onRequestMicrophonePermission = vi
      .fn()
      .mockResolvedValue({ canPrompt: false, status: 'granted' })

    renderDictationPanel({ onRequestMicrophonePermission })

    fireEvent.click(screen.getByRole('button', { name: 'Allow microphone' }))

    expect(onRequestMicrophonePermission).toHaveBeenCalledOnce()
  })

  it('opens macOS microphone settings when permission is blocked', () => {
    const onOpenMicrophoneSettings = vi.fn()

    renderDictationPanel({
      microphonePermission: {
        canPrompt: false,
        message: 'Microphone access is blocked in macOS Privacy settings.',
        status: 'denied'
      },
      onOpenMicrophoneSettings
    })

    fireEvent.click(screen.getByRole('button', { name: 'Open macOS settings' }))

    expect(onOpenMicrophoneSettings).toHaveBeenCalledOnce()
  })

  it('updates the dictation bind', () => {
    const onChangeFeatureSettings = vi.fn()

    renderDictationPanel({ onChangeFeatureSettings })

    fireEvent.click(screen.getByRole('radio', { name: 'Option+Shift' }))

    expect(onChangeFeatureSettings).toHaveBeenCalledWith({
      ...featureSettings,
      localTranscriberShortcut: 'option-shift-hold'
    })
  })

  it('updates the dictation microphone', () => {
    const onChangeFeatureSettings = vi.fn()

    renderDictationPanel({ onChangeFeatureSettings })

    fireEvent.change(screen.getByRole('combobox', { name: 'Dictation microphone' }), {
      target: { value: 'macbook-mic' }
    })

    expect(onChangeFeatureSettings).toHaveBeenCalledWith({
      ...featureSettings,
      localTranscriberAudioInputDeviceId: 'macbook-mic'
    })
  })

  it('starts the Parakeet install inside Pixel', () => {
    const onInstallParakeet = vi.fn()

    renderDictationPanel({ onInstallParakeet })

    fireEvent.click(screen.getByRole('button', { name: 'Download Parakeet (~461 MB)' }))

    expect(onInstallParakeet).toHaveBeenCalledOnce()
  })

  it('shows Parakeet download progress', () => {
    renderDictationPanel({
      dictationSnapshot: {
        ...dictationSnapshot,
        model: {
          ...dictationSnapshot.model,
          currentFile: 'Encoder.mlmodelc/weights/weight.bin',
          downloadedBytes: 241_500_000,
          percent: 50,
          status: 'downloading',
          totalBytes: 483_000_000
        }
      }
    })

    expect(screen.getByRole('progressbar', { name: 'Parakeet download progress' })).toHaveAttribute(
      'aria-valuenow',
      '50'
    )
    expect(screen.getByText('Encoder.mlmodelc/weights/weight.bin')).toBeInTheDocument()
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
