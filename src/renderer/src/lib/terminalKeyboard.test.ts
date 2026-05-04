import { describe, expect, it } from 'vitest'
import { handleTerminalKeyEvent, isLinuxTerminalCopyShortcut } from './terminalKeyboard'

function createKeyEvent(overrides: Partial<KeyboardEvent> = {}): KeyboardEvent {
  return {
    altKey: false,
    ctrlKey: false,
    isComposing: false,
    key: '',
    metaKey: false,
    preventDefault: () => undefined,
    shiftKey: false,
    stopPropagation: () => undefined,
    type: 'keydown',
    ...overrides
  } as KeyboardEvent
}

describe('terminalKeyboard', () => {
  it('detects the Linux terminal copy shortcut', () => {
    expect(
      isLinuxTerminalCopyShortcut(
        createKeyEvent({ ctrlKey: true, key: 'c', shiftKey: true }),
        'Linux x86_64'
      )
    ).toBe(true)
  })

  it('keeps the existing Shift+Enter handling', () => {
    const writes: string[] = []

    expect(
      handleTerminalKeyEvent(createKeyEvent({ key: 'Enter', shiftKey: true }), (data) => {
        writes.push(data)
      })
    ).toBe(false)

    expect(writes).toEqual(['\x1b[13;2u'])
  })
})
