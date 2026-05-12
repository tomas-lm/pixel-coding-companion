import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DictationSnapshot } from '../../../shared/dictation'
import type { WorkspaceFeatureSettings } from '../../../shared/workspace'
import { ConfigsPanel } from './ConfigsPanel'

afterEach(cleanup)

const featureSettings: WorkspaceFeatureSettings = {
  keepLastDictationAudioSample: false,
  localTranscriberEnabled: false,
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
    keepLastAudioSample: false
  },
  shortcut: 'Control+Option',
  state: 'idle'
}

function renderConfigsPanel(
  overrides: Partial<ComponentProps<typeof ConfigsPanel>> = {}
): ReturnType<typeof render> {
  return render(
    <ConfigsPanel
      codeEditorSettings={{ preferredEditor: 'auto' }}
      dictationSnapshot={dictationSnapshot}
      featureSettings={featureSettings}
      terminalThemeId="catppuccin_mocha"
      onChangeCodeEditorSettings={vi.fn()}
      onChangeFeatureSettings={vi.fn()}
      onSelectTerminalTheme={vi.fn()}
      onTestDictation={vi.fn()}
      {...overrides}
    />
  )
}

describe('ConfigsPanel', () => {
  it('renders feature toggles', () => {
    renderConfigsPanel()

    expect(screen.getByRole('heading', { name: 'Configs' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Theme Catppuccin Mocha' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'External code editor' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Play sounds upon finishing' })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Enable local transcriber' })).not.toBeChecked()
    expect(screen.getByText('Control+Option')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Install model' })).toBeDisabled()
  })

  it('updates the sound preference', () => {
    const onChangeFeatureSettings = vi.fn()

    renderConfigsPanel({ onChangeFeatureSettings })

    fireEvent.click(screen.getByRole('checkbox', { name: 'Play sounds upon finishing' }))

    expect(onChangeFeatureSettings).toHaveBeenCalledWith({
      keepLastDictationAudioSample: false,
      localTranscriberEnabled: false,
      playSoundsUponFinishing: true
    })
  })

  it('updates the local transcriber preference', () => {
    const onChangeFeatureSettings = vi.fn()

    renderConfigsPanel({ onChangeFeatureSettings })

    fireEvent.click(screen.getByRole('checkbox', { name: 'Enable local transcriber' }))

    expect(onChangeFeatureSettings).toHaveBeenCalledWith({
      keepLastDictationAudioSample: false,
      localTranscriberEnabled: true,
      playSoundsUponFinishing: false
    })
  })

  it('runs the dictation test when enabled and ready', () => {
    const onTestDictation = vi.fn()

    renderConfigsPanel({
      featureSettings: {
        ...featureSettings,
        localTranscriberEnabled: true
      },
      onTestDictation
    })

    fireEvent.click(screen.getByRole('button', { name: 'Test transcription' }))

    expect(onTestDictation).toHaveBeenCalledOnce()
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
