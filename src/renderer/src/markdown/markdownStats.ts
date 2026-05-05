export type MarkdownEditorStats = {
  characters: number
  column: number
  line: number
  words: number
}

export function getMarkdownEditorStats(text: string, cursorOffset: number): MarkdownEditorStats {
  const cursor = Math.max(0, Math.min(text.length, cursorOffset))
  const words = text.trim().match(/\S+/g)
  const lastLineBreak = text.lastIndexOf('\n', Math.max(0, cursor - 1))
  const line = text.slice(0, cursor).split('\n').length
  const column = cursor - lastLineBreak

  return {
    characters: text.length,
    column,
    line,
    words: words?.length ?? 0
  }
}
