import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ConfigsPanel } from './ConfigsPanel'

afterEach(cleanup)

describe('ConfigsPanel', () => {
  it('renders feature toggles', () => {
    render(
      <ConfigsPanel
        featureSettings={{ playSoundsUponFinishing: false }}
        terminalThemeId="catppuccin_mocha"
        onChangeFeatureSettings={vi.fn()}
        onSelectTerminalTheme={vi.fn()}
      />
    )

    expect(screen.getByRole('heading', { name: 'Configs' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Theme Catppuccin Mocha' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Play sounds upon finishing' })).not.toBeChecked()
  })

  it('updates the sound preference', () => {
    const onChangeFeatureSettings = vi.fn()

    render(
      <ConfigsPanel
        featureSettings={{ playSoundsUponFinishing: false }}
        terminalThemeId="catppuccin_mocha"
        onChangeFeatureSettings={onChangeFeatureSettings}
        onSelectTerminalTheme={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole('checkbox', { name: 'Play sounds upon finishing' }))

    expect(onChangeFeatureSettings).toHaveBeenCalledWith({
      playSoundsUponFinishing: true
    })
  })

  it('updates the terminal theme from dropdown', () => {
    const onSelectTerminalTheme = vi.fn()

    render(
      <ConfigsPanel
        featureSettings={{ playSoundsUponFinishing: false }}
        terminalThemeId="catppuccin_mocha"
        onChangeFeatureSettings={vi.fn()}
        onSelectTerminalTheme={onSelectTerminalTheme}
      />
    )

    fireEvent.click(screen.getByRole('combobox', { name: 'Theme Catppuccin Mocha' }))
    fireEvent.click(screen.getByRole('option', { name: 'Tokyo Night' }))

    expect(onSelectTerminalTheme).toHaveBeenCalledWith('tokyo_night')
  })

  it('supports keyboard theme selection', () => {
    const onSelectTerminalTheme = vi.fn()

    render(
      <ConfigsPanel
        featureSettings={{ playSoundsUponFinishing: false }}
        terminalThemeId="catppuccin_mocha"
        onChangeFeatureSettings={vi.fn()}
        onSelectTerminalTheme={onSelectTerminalTheme}
      />
    )

    const trigger = screen.getByRole('combobox', { name: 'Theme Catppuccin Mocha' })
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    fireEvent.keyDown(screen.getByRole('listbox', { name: 'Terminal themes' }), { key: 'Enter' })

    expect(onSelectTerminalTheme).toHaveBeenCalledWith('one_dark_pro')
  })
})
