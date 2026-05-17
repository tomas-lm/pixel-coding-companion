import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getDictationShortcutLabel, type DictationSnapshot } from '../../../shared/dictation'
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
  shortcutAvailability: {
    mode: 'hold',
    scope: 'focused'
  },
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
      dictationSnapshot: {
        ...dictationSnapshot,
        backend: {
          available: true,
          id: 'macos-parakeet-coreml',
          label: 'Parakeet CoreML',
          ready: false,
          status: 'not_installed'
        }
      },
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

  it('does not show macOS settings for Linux microphone denial', () => {
    renderDictationPanel({
      dictationSnapshot: {
        ...dictationSnapshot,
        backend: {
          available: true,
          id: 'onnx-sherpa',
          label: 'Parakeet ONNX',
          ready: false,
          status: 'not_installed'
        }
      },
      microphonePermission: {
        canPrompt: false,
        message: 'Microphone access is blocked in system privacy settings.',
        status: 'denied'
      }
    })

    expect(screen.queryByRole('button', { name: 'Open macOS settings' })).not.toBeInTheDocument()
  })

  it('updates the dictation bind', () => {
    const onChangeFeatureSettings = vi.fn()

    renderDictationPanel({ onChangeFeatureSettings })

    fireEvent.click(
      screen.getByRole('radio', {
        name: getDictationShortcutLabel('option-shift-hold', process.platform)
      })
    )

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

  it('uses ONNX model copy for the Linux backend', () => {
    renderDictationPanel({
      dictationSnapshot: {
        ...dictationSnapshot,
        backend: {
          available: true,
          id: 'onnx-sherpa',
          label: 'Parakeet ONNX',
          ready: false,
          status: 'not_installed'
        },
        shortcutAvailability: {
          mode: 'toggle',
          scope: 'global'
        },
        model: {
          ...dictationSnapshot.model,
          requiredBytesLabel: '~661 MB'
        }
      }
    })

    expect(
      screen.getByText(/Pixel downloads the required Parakeet ONNX assets directly into app data/)
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Download Parakeet (~661 MB)' })).toBeInTheDocument()
    expect(
      screen.getByText('Linux uses a toggle shortcut. Press once to start and again to stop.')
    ).toBeInTheDocument()
  })

  it('shows Linux focused fallback messaging only when the shortcut is not global', () => {
    renderDictationPanel({
      dictationSnapshot: {
        ...dictationSnapshot,
        backend: {
          available: true,
          id: 'onnx-sherpa',
          label: 'Parakeet ONNX',
          ready: true,
          status: 'ready'
        },
        shortcut: 'Ctrl+Alt+Space',
        shortcutAvailability: {
          message:
            'Pixel could not register Ctrl+Alt+Space as a global Linux shortcut. Another app or desktop session may already be using it, so the bind will work while Pixel is focused.',
          mode: 'toggle',
          scope: 'focused'
        }
      }
    })

    expect(
      screen.getByText(/could not register Ctrl\+Alt\+Space as a global Linux shortcut/i)
    ).toBeInTheDocument()
  })

  it('does not show Linux focused fallback messaging for non-Linux snapshots', () => {
    renderDictationPanel()

    expect(
      screen.queryByText(/global Linux shortcut|while Pixel is focused/i)
    ).not.toBeInTheDocument()
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
