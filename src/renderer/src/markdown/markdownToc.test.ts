import { markdown } from '@codemirror/lang-markdown'
import { EditorState } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import { extractMarkdownTableOfContents } from './markdownToc'

function createMarkdownState(doc: string): EditorState {
  return EditorState.create({
    doc,
    extensions: [markdown()]
  })
}

describe('extractMarkdownTableOfContents', () => {
  it('extracts ATX headings from the syntax tree', () => {
    const toc = extractMarkdownTableOfContents(
      createMarkdownState('# Title\n\nParagraph\n\n## Next ##\n### Deep')
    )

    expect(toc).toMatchObject([
      { level: 1, line: 1, title: 'Title' },
      { level: 2, line: 5, title: 'Next' },
      { level: 3, line: 6, title: 'Deep' }
    ])
  })

  it('ignores empty headings', () => {
    expect(extractMarkdownTableOfContents(createMarkdownState('#\n\n## Valid'))).toMatchObject([
      { level: 2, title: 'Valid' }
    ])
  })
})
