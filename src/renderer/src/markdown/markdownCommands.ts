export type MarkdownTextSelection = {
  from: number
  to: number
}

export type MarkdownTextEdit = {
  from: number
  insert: string
  selectionAnchor?: number
  selectionHead?: number
  to: number
}

function normalizeSelection(selection: MarkdownTextSelection): MarkdownTextSelection {
  return selection.from <= selection.to
    ? selection
    : {
        from: selection.to,
        to: selection.from
      }
}

function clampOffset(text: string, offset: number): number {
  return Math.max(0, Math.min(text.length, offset))
}

function getLineRange(text: string, selection: MarkdownTextSelection): MarkdownTextSelection {
  const normalized = normalizeSelection(selection)
  const from = clampOffset(text, normalized.from)
  const to = clampOffset(text, normalized.to)
  const lineStart = text.lastIndexOf('\n', Math.max(0, from - 1)) + 1
  const searchFrom = to > from && text[to - 1] === '\n' ? to - 1 : to
  const nextLineBreak = text.indexOf('\n', searchFrom)

  return {
    from: lineStart,
    to: nextLineBreak === -1 ? text.length : nextLineBreak
  }
}

export function applyMarkdownTextEdit(text: string, edit: MarkdownTextEdit): string {
  return `${text.slice(0, edit.from)}${edit.insert}${text.slice(edit.to)}`
}

export function toggleInlineMarkdown(
  text: string,
  selection: MarkdownTextSelection,
  marker: '**' | '*'
): MarkdownTextEdit {
  const normalized = normalizeSelection(selection)
  const from = clampOffset(text, normalized.from)
  const to = clampOffset(text, normalized.to)
  const selectedText = text.slice(from, to)

  if (
    selectedText.startsWith(marker) &&
    selectedText.endsWith(marker) &&
    selectedText.length >= marker.length * 2
  ) {
    const insert = selectedText.slice(marker.length, selectedText.length - marker.length)

    return {
      from,
      to,
      insert,
      selectionAnchor: from,
      selectionHead: from + insert.length
    }
  }

  if (!selectedText) {
    const insert = `${marker}${marker}`
    const cursor = from + marker.length

    return {
      from,
      to,
      insert,
      selectionAnchor: cursor,
      selectionHead: cursor
    }
  }

  const insert = `${marker}${selectedText}${marker}`

  return {
    from,
    to,
    insert,
    selectionAnchor: from + marker.length,
    selectionHead: from + marker.length + selectedText.length
  }
}

export function insertMarkdownLink(
  text: string,
  selection: MarkdownTextSelection,
  kind: 'image' | 'link'
): MarkdownTextEdit {
  const normalized = normalizeSelection(selection)
  const from = clampOffset(text, normalized.from)
  const to = clampOffset(text, normalized.to)
  const selectedText = text.slice(from, to)
  const label = selectedText || (kind === 'image' ? 'alt text' : 'link text')
  const target = kind === 'image' ? 'image-url' : 'url'
  const prefix = kind === 'image' ? '![' : '['
  const insert = `${prefix}${label}](${target})`
  const targetStart = from + prefix.length + label.length + 2

  return {
    from,
    to,
    insert,
    selectionAnchor: targetStart,
    selectionHead: targetStart + target.length
  }
}

export function toggleTaskList(text: string, selection: MarkdownTextSelection): MarkdownTextEdit {
  const range = getLineRange(text, selection)
  const block = text.slice(range.from, range.to)
  const lines = block.split('\n')
  const editableLines = lines.filter((line) => line.trim().length > 0)
  const allTaskItems =
    editableLines.length > 0 && editableLines.every((line) => /^\s*[-*+] \[[ xX]\] /.test(line))
  const insert = lines
    .map((line) => {
      if (!line.trim()) return line

      if (allTaskItems) {
        return line.replace(/^(\s*)[-*+] \[[ xX]\] /, '$1- ')
      }

      if (/^\s*[-*+]\s+/.test(line)) {
        return line.replace(/^(\s*)[-*+]\s+/, '$1- [ ] ')
      }

      if (/^\s*\d+\.\s+/.test(line)) {
        return line.replace(/^(\s*)\d+\.\s+/, '$1- [ ] ')
      }

      return line.replace(/^(\s*)/, '$1- [ ] ')
    })
    .join('\n')
  const delta = insert.length - block.length

  return {
    from: range.from,
    to: range.to,
    insert,
    selectionAnchor: selection.from,
    selectionHead: selection.to + delta
  }
}

export function toggleHeading(
  text: string,
  selection: MarkdownTextSelection,
  level: 1 | 2 | 3 | 4 | 5 | 6
): MarkdownTextEdit {
  const range = getLineRange(text, {
    from: selection.from,
    to: selection.from
  })
  const line = text.slice(range.from, range.to)
  const headingMatch = /^(#{1,6})\s+(.*)$/.exec(line)
  const currentLevel = headingMatch?.[1].length
  const body = (headingMatch?.[2] ?? line).replace(/\s+#+\s*$/, '').trim() || 'Heading'
  const insert = currentLevel === level ? body : `${'#'.repeat(level)} ${body}`
  const bodyOffset = currentLevel === level ? 0 : level + 1

  return {
    from: range.from,
    to: range.to,
    insert,
    selectionAnchor: range.from + bodyOffset,
    selectionHead: range.from + bodyOffset + body.length
  }
}
