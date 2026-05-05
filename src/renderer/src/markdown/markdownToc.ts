import { syntaxTree } from '@codemirror/language'
import type { EditorState } from '@codemirror/state'

export type MarkdownTableOfContentsItem = {
  from: number
  level: number
  line: number
  title: string
  to: number
}

function cleanHeadingTitle(source: string): string {
  return source
    .replace(/^#{1,6}\s*/, '')
    .replace(/\n[=-]+\s*$/, '')
    .replace(/\s+#+\s*$/, '')
    .trim()
}

export function extractMarkdownTableOfContents(state: EditorState): MarkdownTableOfContentsItem[] {
  const items: MarkdownTableOfContentsItem[] = []

  syntaxTree(state).iterate({
    enter(node) {
      const levelMatch = /Heading([1-6])$/.exec(node.name)
      if (!levelMatch) return

      const title = cleanHeadingTitle(state.doc.sliceString(node.from, node.to))
      if (!title) return

      items.push({
        from: node.from,
        level: Number(levelMatch[1]),
        line: state.doc.lineAt(node.from).number,
        title,
        to: node.to
      })
    }
  })

  return items
}
