import { describe, expect, it } from 'vitest'
import {
  applyMarkdownTextEdit,
  insertMarkdownLink,
  toggleHeading,
  toggleInlineMarkdown,
  toggleTaskList
} from './markdownCommands'

describe('markdownCommands', () => {
  it('wraps and unwraps inline markdown', () => {
    const bold = toggleInlineMarkdown('hello world', { from: 6, to: 11 }, '**')
    expect(applyMarkdownTextEdit('hello world', bold)).toBe('hello **world**')

    const plain = toggleInlineMarkdown('hello **world**', { from: 6, to: 15 }, '**')
    expect(applyMarkdownTextEdit('hello **world**', plain)).toBe('hello world')
  })

  it('inserts link and image syntax around the selected text', () => {
    const link = insertMarkdownLink('See Pixel', { from: 4, to: 9 }, 'link')
    expect(applyMarkdownTextEdit('See Pixel', link)).toBe('See [Pixel](url)')

    const image = insertMarkdownLink('Logo', { from: 0, to: 4 }, 'image')
    expect(applyMarkdownTextEdit('Logo', image)).toBe('![Logo](image-url)')
  })

  it('toggles task list syntax for selected lines', () => {
    const source = 'first\nsecond'
    const task = toggleTaskList(source, { from: 0, to: source.length })
    expect(applyMarkdownTextEdit(source, task)).toBe('- [ ] first\n- [ ] second')

    const normal = toggleTaskList('- [ ] first\n- [x] second', { from: 0, to: 23 })
    expect(applyMarkdownTextEdit('- [ ] first\n- [x] second', normal)).toBe('- first\n- second')
  })

  it('sets and removes heading markers', () => {
    const heading = toggleHeading('Title', { from: 0, to: 0 }, 2)
    expect(applyMarkdownTextEdit('Title', heading)).toBe('## Title')

    const plain = toggleHeading('## Title', { from: 3, to: 3 }, 2)
    expect(applyMarkdownTextEdit('## Title', plain)).toBe('Title')
  })
})
