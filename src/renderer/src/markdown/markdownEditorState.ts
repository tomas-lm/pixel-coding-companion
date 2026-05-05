import { EditorSelection } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'

export type SerializedMarkdownEditorState = {
  filePath: string
  scrollTop: number
  selectionAnchor: number
  selectionHead: number
}

function clampOffset(offset: number, docLength: number): number {
  return Math.max(0, Math.min(docLength, offset))
}

export function createEmptyMarkdownEditorState(filePath: string): SerializedMarkdownEditorState {
  return {
    filePath,
    scrollTop: 0,
    selectionAnchor: 0,
    selectionHead: 0
  }
}

export function serializeMarkdownEditorState(
  filePath: string,
  view: EditorView
): SerializedMarkdownEditorState {
  const selection = view.state.selection.main

  return {
    filePath,
    scrollTop: view.scrollDOM.scrollTop,
    selectionAnchor: selection.anchor,
    selectionHead: selection.head
  }
}

export function createRestoredEditorSelection(
  docLength: number,
  savedState?: SerializedMarkdownEditorState
): EditorSelection | undefined {
  if (!savedState) return undefined

  return EditorSelection.create([
    EditorSelection.range(
      clampOffset(savedState.selectionAnchor, docLength),
      clampOffset(savedState.selectionHead, docLength)
    )
  ])
}

export function restoreMarkdownEditorState(
  view: EditorView,
  savedState?: SerializedMarkdownEditorState
): void {
  if (!savedState) return

  const selection = createRestoredEditorSelection(view.state.doc.length, savedState)
  if (selection) {
    view.dispatch({
      selection,
      scrollIntoView: true
    })
  }

  view.scrollDOM.scrollTop = Math.max(0, savedState.scrollTop)
}
