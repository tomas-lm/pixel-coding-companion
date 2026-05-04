import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ConfigsPanel } from './ConfigsPanel'

afterEach(cleanup)

describe('ConfigsPanel', () => {
  it('renders feature toggles', () => {
    render(
      <ConfigsPanel
        featureSettings={{ playSoundsUponFinishing: false }}
        onChangeFeatureSettings={vi.fn()}
      />
    )

    expect(screen.getByRole('heading', { name: 'Configs' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Play sounds upon finishing' })).not.toBeChecked()
  })

  it('updates the sound preference', () => {
    const onChangeFeatureSettings = vi.fn()

    render(
      <ConfigsPanel
        featureSettings={{ playSoundsUponFinishing: false }}
        onChangeFeatureSettings={onChangeFeatureSettings}
      />
    )

    fireEvent.click(screen.getByRole('checkbox', { name: 'Play sounds upon finishing' }))

    expect(onChangeFeatureSettings).toHaveBeenCalledWith({
      playSoundsUponFinishing: true
    })
  })
})
