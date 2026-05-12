import { describe, expect, it } from 'vitest'
import { ModifierHoldShortcut } from './modifierHoldShortcut'

describe('ModifierHoldShortcut', () => {
  it('starts when Control and Option are held together after debounce commit', () => {
    const shortcut = new ModifierHoldShortcut()

    expect(
      shortcut.update({
        alt: false,
        control: true,
        key: 'Control',
        type: 'keyDown'
      })
    ).toEqual({ type: 'none' })
    expect(
      shortcut.update({
        alt: true,
        control: true,
        key: 'Alt',
        type: 'keyDown'
      })
    ).toEqual({ type: 'schedule_start' })

    expect(shortcut.commitPendingStart()).toBe(true)
  })

  it('does not start when Control+Option is part of another key chord', () => {
    const shortcut = new ModifierHoldShortcut()

    expect(
      shortcut.update({
        alt: true,
        control: true,
        key: 'Alt',
        type: 'keyDown'
      })
    ).toEqual({ type: 'schedule_start' })
    expect(
      shortcut.update({
        alt: true,
        control: true,
        key: 'K',
        type: 'keyDown'
      })
    ).toEqual({ type: 'cancel_pending_start' })

    expect(shortcut.commitPendingStart()).toBe(false)
  })

  it('stops when either modifier is released', () => {
    const shortcut = new ModifierHoldShortcut()

    shortcut.update({
      alt: true,
      control: true,
      key: 'Alt',
      type: 'keyDown'
    })
    expect(shortcut.commitPendingStart()).toBe(true)

    expect(
      shortcut.update({
        alt: false,
        control: true,
        key: 'Alt',
        type: 'keyUp'
      })
    ).toEqual({ type: 'stop_recording' })
  })
})
