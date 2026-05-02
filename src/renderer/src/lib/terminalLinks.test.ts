import { describe, expect, it } from 'vitest'
import { findTerminalLinks } from './terminalLinks'

describe('terminalLinks', () => {
  it('detects external URLs and trims trailing punctuation', () => {
    expect(findTerminalLinks('Open https://example.com/docs.')).toEqual([
      {
        endIndex: 29,
        request: {
          kind: 'external_url',
          url: 'https://example.com/docs'
        },
        startIndex: 5,
        text: 'https://example.com/docs'
      }
    ])
  })

  it('detects file paths with line and column suffixes', () => {
    expect(findTerminalLinks('at src/renderer/src/App.tsx:42:7', '/repo')).toEqual([
      {
        endIndex: 32,
        request: {
          column: 7,
          cwd: '/repo',
          kind: 'file_path',
          line: 42,
          path: 'src/renderer/src/App.tsx'
        },
        startIndex: 3,
        text: 'src/renderer/src/App.tsx'
      }
    ])
  })

  it('ignores numeric versions that look like dotted filenames', () => {
    expect(findTerminalLinks('installed version 1.2.3')).toEqual([])
  })
})
