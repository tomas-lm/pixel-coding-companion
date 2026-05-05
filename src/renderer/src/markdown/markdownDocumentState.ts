export type MarkdownDocumentBuffer = {
  content: string
  isDirty: boolean
  savedContent: string
}

export function createMarkdownDocumentBuffer(content: string): MarkdownDocumentBuffer {
  return {
    content,
    isDirty: false,
    savedContent: content
  }
}

export function changeMarkdownDocumentBuffer(
  buffer: MarkdownDocumentBuffer,
  content: string
): MarkdownDocumentBuffer {
  return {
    ...buffer,
    content,
    isDirty: content !== buffer.savedContent
  }
}

export function saveMarkdownDocumentBuffer(
  buffer: MarkdownDocumentBuffer,
  savedContent = buffer.content
): MarkdownDocumentBuffer {
  return {
    content: savedContent,
    isDirty: false,
    savedContent
  }
}
