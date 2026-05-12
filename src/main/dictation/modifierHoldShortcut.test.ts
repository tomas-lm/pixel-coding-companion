import { describe, expect, it } from 'vitest'
import type { ModifierHoldKeyEvent } from './modifierHoldShortcut'
import { ModifierHoldShortcut } from './modifierHoldShortcut'

function event(overrides: Partial<ModifierHoldKeyEvent>): ModifierHoldKeyEvent {
  return {
    alt: false,
    control: false,
    key: 'Control',
    meta: false,
    shift: false,
    type: 'keyDown',
    ...overrides
  }
}

describe('ModifierHoldShortcut', () => {
  it('starts when Control and Option are held together after debounce commit', () => {
    const shortcut = new ModifierHoldShortcut()

    expect(
      shortcut.update(
        event({
          alt: false,
          control: true,
          key: 'Control'
        })
      )
    ).toEqual({ type: 'none' })
    expect(
      shortcut.update(
        event({
          alt: true,
          control: true,
          key: 'Alt'
        })
      )
    ).toEqual({ type: 'schedule_start' })

    expect(shortcut.commitPendingStart()).toBe(true)
  })

  it('does not start when Control+Option is part of another key chord', () => {
    const shortcut = new ModifierHoldShortcut()

    expect(
      shortcut.update(
        event({
          alt: true,
          control: true,
          key: 'Alt'
        })
      )
    ).toEqual({ type: 'schedule_start' })
    expect(
      shortcut.update(
        event({
          alt: true,
          control: true,
          key: 'K'
        })
      )
    ).toEqual({ type: 'cancel_pending_start' })

    expect(shortcut.commitPendingStart()).toBe(false)
  })

  it('stops when either modifier is released', () => {
    const shortcut = new ModifierHoldShortcut()

    shortcut.update(
      event({
        alt: true,
        control: true,
        key: 'Alt'
      })
    )
    expect(shortcut.commitPendingStart()).toBe(true)

    expect(
      shortcut.update(
        event({
          alt: false,
          control: true,
          key: 'Alt',
          type: 'keyUp'
        })
      )
    ).toEqual({ type: 'stop_recording' })
  })

  it('supports configured modifier-only binds', () => {
    const shortcut = new ModifierHoldShortcut()

    expect(
      shortcut.update(
        event({
          control: true,
          key: 'Control',
          shift: true
        }),
        'control-shift-hold'
      )
    ).toEqual({ type: 'schedule_start' })

    expect(shortcut.commitPendingStart()).toBe(true)
  })
})
