import { describe, expect, it } from 'vitest'
import { getMarkdownEditorStats } from './markdownStats'

describe('getMarkdownEditorStats', () => {
  it('counts words, characters, line, and column', () => {
    expect(getMarkdownEditorStats('one two\nthree', 9)).toEqual({
      characters: 13,
      column: 2,
      line: 2,
      words: 3
    })
  })

  it('clamps cursor offsets', () => {
    expect(getMarkdownEditorStats('', 99)).toEqual({
      characters: 0,
      column: 1,
      line: 1,
      words: 0
    })
  })
})
