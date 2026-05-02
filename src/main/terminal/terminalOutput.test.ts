import { describe, expect, it } from 'vitest'
import {
  COMMAND_EXIT_COMMAND,
  COMMAND_EXIT_MARKER,
  COMMAND_EXIT_PATTERN,
  appendTerminalOutputBuffer,
  getMarkerPrefixLength,
  isCodexCliReady,
  stripAnsiSequences
} from './terminalOutput'

describe('terminalOutput', () => {
  it('detects partial command-exit markers at chunk boundaries', () => {
    expect(getMarkerPrefixLength(`hello\n${COMMAND_EXIT_MARKER.slice(0, 12)}`)).toBe(12)
    expect(getMarkerPrefixLength('hello')).toBe(0)
  })

  it('matches command exit markers without exposing the shell command', () => {
    const output = `before\n${COMMAND_EXIT_MARKER}7\nafter`.replace(COMMAND_EXIT_COMMAND, '')
    const matches = Array.from(output.matchAll(COMMAND_EXIT_PATTERN))

    expect(matches).toHaveLength(1)
    expect(matches[0][1]).toBe('7')
  })

  it('keeps only the end of the terminal replay buffer', () => {
    expect(appendTerminalOutputBuffer('abc', 'def', 4)).toBe('cdef')
    expect(appendTerminalOutputBuffer('abc', '', 4)).toBe('abc')
  })

  it('strips ANSI sequences before checking Codex readiness', () => {
    expect(stripAnsiSequences('\u001b[32mTip: Use /skills\u001b[0m')).toBe('Tip: Use /skills')
    expect(isCodexCliReady('\u001b[32mTip: Use /skills\u001b[0m')).toBe(true)
    expect(isCodexCliReady('›')).toBe(true)
    expect(isCodexCliReady('still booting')).toBe(false)
  })
})
