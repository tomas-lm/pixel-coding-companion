import { describe, expect, it } from 'vitest'
import {
  createEmptyMarkdownEditorState,
  createRestoredEditorSelection
} from './markdownEditorState'

describe('markdownEditorState', () => {
  it('creates an empty persisted state for a file', () => {
    expect(createEmptyMarkdownEditorState('/vault/note.md')).toEqual({
      filePath: '/vault/note.md',
      scrollTop: 0,
      selectionAnchor: 0,
      selectionHead: 0
    })
  })

  it('restores and clamps saved selections', () => {
    const selection = createRestoredEditorSelection(10, {
      filePath: '/vault/note.md',
      scrollTop: 12,
      selectionAnchor: 4,
      selectionHead: 99
    })

    expect(selection?.main.anchor).toBe(4)
    expect(selection?.main.head).toBe(10)
  })

  it('returns no selection when no state is available', () => {
    expect(createRestoredEditorSelection(10)).toBeUndefined()
  })
})
