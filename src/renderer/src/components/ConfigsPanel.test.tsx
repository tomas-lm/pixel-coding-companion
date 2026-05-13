import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { WorkspaceFeatureSettings } from '../../../shared/workspace'
import { ConfigsPanel } from './ConfigsPanel'

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

function renderConfigsPanel(
  overrides: Partial<ComponentProps<typeof ConfigsPanel>> = {}
): ReturnType<typeof render> {
  return render(
    <ConfigsPanel
      activeSection="general"
      audioInputDevices={[]}
      codeEditorSettings={{ preferredEditor: 'auto' }}
      dictationHistoryEntries={[]}
      dictationHistoryQuery=""
      dictationSnapshot={null}
      dictationStats={null}
      featureSettings={featureSettings}
      microphonePermission={null}
      terminalThemeId="catppuccin_mocha"
      onChangeHistoryQuery={vi.fn()}
      onClearHistory={vi.fn()}
      onChangeCodeEditorSettings={vi.fn()}
      onChangeFeatureSettings={vi.fn()}
      onCopyHistoryEntry={vi.fn()}
      onDeleteHistoryEntry={vi.fn()}
      onInstallParakeet={vi.fn()}
      onOpenMicrophoneSettings={vi.fn()}
      onRefreshAudioInputs={vi.fn()}
      onRequestMicrophonePermission={vi
        .fn()
        .mockResolvedValue({ canPrompt: false, status: 'granted' })}
      onSectionChange={vi.fn()}
      onSelectTerminalTheme={vi.fn()}
      onTestDictation={vi.fn()}
      {...overrides}
    />
  )
}

describe('ConfigsPanel', () => {
  it('renders feature toggles', () => {
    renderConfigsPanel()

    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Theme Catppuccin Mocha' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'External code editor' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Play sounds upon finishing' })).not.toBeChecked()
  })

  it('updates the sound preference', () => {
    const onChangeFeatureSettings = vi.fn()

    renderConfigsPanel({ onChangeFeatureSettings })

    fireEvent.click(screen.getByRole('checkbox', { name: 'Play sounds upon finishing' }))

    expect(onChangeFeatureSettings).toHaveBeenCalledWith({
      ...featureSettings,
      playSoundsUponFinishing: true
    })
  })

  it('renders audio settings inside settings', () => {
    renderConfigsPanel({ activeSection: 'audio' })

    expect(screen.getByRole('checkbox', { name: 'Show dictation overlay' })).toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: 'Search dictation history' })).toBeInTheDocument()
  })

  it('updates the preferred code editor', () => {
    const onChangeCodeEditorSettings = vi.fn()

    renderConfigsPanel({ onChangeCodeEditorSettings })

    fireEvent.click(screen.getByRole('button', { name: 'Cursor' }))

    expect(onChangeCodeEditorSettings).toHaveBeenCalledWith({
      preferredEditor: 'cursor'
    })
  })

  it('updates the terminal theme from dropdown', () => {
    const onSelectTerminalTheme = vi.fn()

    renderConfigsPanel({ onSelectTerminalTheme })

    fireEvent.click(screen.getByRole('combobox', { name: 'Theme Catppuccin Mocha' }))
    fireEvent.click(screen.getByRole('option', { name: 'Tokyo Night' }))

    expect(onSelectTerminalTheme).toHaveBeenCalledWith('tokyo_night')
  })

  it('supports keyboard theme selection', () => {
    const onSelectTerminalTheme = vi.fn()

    renderConfigsPanel({ onSelectTerminalTheme })

    const trigger = screen.getByRole('combobox', { name: 'Theme Catppuccin Mocha' })
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    fireEvent.keyDown(screen.getByRole('listbox', { name: 'Terminal themes' }), { key: 'Enter' })

    expect(onSelectTerminalTheme).toHaveBeenCalledWith('one_dark_pro')
  })
})
