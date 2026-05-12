import { afterEach, describe, expect, it, vi } from 'vitest'
import { insertDictationTranscript, insertTextIntoFocusedPixelTarget } from './dictationInsertion'

afterEach(() => {
  document.body.innerHTML = ''
})

describe('dictationInsertion', () => {
  it('inserts text into the focused input', () => {
    const input = document.createElement('input')
    input.value = 'hello '
    document.body.append(input)
    input.focus()
    input.setSelectionRange(input.value.length, input.value.length)

    expect(insertTextIntoFocusedPixelTarget('pixel')).toBe(true)
    expect(input.value).toBe('hello pixel')
  })

  it('inserts text into the focused textarea selection', () => {
    const textarea = document.createElement('textarea')
    textarea.value = 'hello old'
    document.body.append(textarea)
    textarea.focus()
    textarea.setSelectionRange(6, 9)

    expect(insertTextIntoFocusedPixelTarget('pixel')).toBe(true)
    expect(textarea.value).toBe('hello pixel')
  })

  it('writes to the active terminal when no Pixel text target is focused', () => {
    const writeTerminal = vi.fn()
    const writeClipboard = vi.fn()

    const target = insertDictationTranscript('hello terminal', {
      terminalSessionId: 'session-1',
      writeClipboard,
      writeTerminal
    })

    expect(target).toBe('terminal')
    expect(writeTerminal).toHaveBeenCalledWith({
      data: 'hello terminal',
      id: 'session-1'
    })
    expect(writeClipboard).not.toHaveBeenCalled()
  })

  it('copies to clipboard when no Pixel text target or terminal is available', () => {
    const writeTerminal = vi.fn()
    const writeClipboard = vi.fn()

    const target = insertDictationTranscript('hello clipboard', {
      writeClipboard,
      writeTerminal
    })

    expect(target).toBe('clipboard')
    expect(writeClipboard).toHaveBeenCalledWith('hello clipboard')
    expect(writeTerminal).not.toHaveBeenCalled()
  })
})
