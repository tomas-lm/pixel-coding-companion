import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { WorkspaceFeatureSettings } from '../../../shared/workspace'
import { ConfigsPanel } from './ConfigsPanel'

afterEach(cleanup)

const featureSettings: WorkspaceFeatureSettings = {
  keepLastDictationAudioSample: false,
  localTranscriberEnabled: false,
  localTranscriberShortcut: 'control-option-hold',
  playSoundsUponFinishing: false
}

function renderConfigsPanel(
  overrides: Partial<ComponentProps<typeof ConfigsPanel>> = {}
): ReturnType<typeof render> {
  return render(
    <ConfigsPanel
      codeEditorSettings={{ preferredEditor: 'auto' }}
      featureSettings={featureSettings}
      terminalThemeId="catppuccin_mocha"
      onChangeCodeEditorSettings={vi.fn()}
      onChangeFeatureSettings={vi.fn()}
      onSelectTerminalTheme={vi.fn()}
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
  })

  it('updates the sound preference', () => {
    const onChangeFeatureSettings = vi.fn()

    renderConfigsPanel({ onChangeFeatureSettings })

    fireEvent.click(screen.getByRole('checkbox', { name: 'Play sounds upon finishing' }))

    expect(onChangeFeatureSettings).toHaveBeenCalledWith({
      keepLastDictationAudioSample: false,
      localTranscriberEnabled: false,
      localTranscriberShortcut: 'control-option-hold',
      playSoundsUponFinishing: true
    })
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
