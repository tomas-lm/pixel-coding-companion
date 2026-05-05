import { describe, expect, it } from 'vitest'
import {
  changeMarkdownDocumentBuffer,
  createMarkdownDocumentBuffer,
  saveMarkdownDocumentBuffer
} from './markdownDocumentState'

describe('markdownDocumentState', () => {
  it('tracks dirty transitions from load to change to save', () => {
    const loaded = createMarkdownDocumentBuffer('# Note')
    expect(loaded.isDirty).toBe(false)

    const changed = changeMarkdownDocumentBuffer(loaded, '# Note\n\nUpdated')
    expect(changed.isDirty).toBe(true)

    const saved = saveMarkdownDocumentBuffer(changed)
    expect(saved).toEqual({
      content: '# Note\n\nUpdated',
      isDirty: false,
      savedContent: '# Note\n\nUpdated'
    })
  })
})
