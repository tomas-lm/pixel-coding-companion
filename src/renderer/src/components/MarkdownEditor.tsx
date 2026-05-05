import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import {
  insertMarkdownLink,
  toggleHeading,
  toggleInlineMarkdown,
  toggleTaskList,
  type MarkdownTextEdit
} from '../markdown/markdownCommands'
import { getCoreExtensions, getMarkdownExtensions } from '../markdown/markdownEditorExtensions'
import {
  restoreMarkdownEditorState,
  serializeMarkdownEditorState,
  type SerializedMarkdownEditorState
} from '../markdown/markdownEditorState'
import { createMarkdownRenderExtension } from '../markdown/markdownRenderers'
import { getMarkdownEditorStats, type MarkdownEditorStats } from '../markdown/markdownStats'
import {
  extractMarkdownTableOfContents,
  type MarkdownTableOfContentsItem
} from '../markdown/markdownToc'

export type MarkdownEditorHandle = {
  focus: () => void
  getValue: () => string
  insertImage: () => void
  insertLink: () => void
  scrollToOffset: (offset: number) => void
  toggleBold: () => void
  toggleHeading: (level: 1 | 2 | 3 | 4 | 5 | 6) => void
  toggleItalic: () => void
  toggleTaskList: () => void
}

type MarkdownEditorProps = {
  filePath: string
  getInitialState?: (filePath: string) => SerializedMarkdownEditorState | undefined
  initialValue: string
  onChange: (value: string) => void
  onOpenLink: (href: string) => void
  onOpenWikiLink: (target: string) => void
  onPersistState: (filePath: string, state: SerializedMarkdownEditorState) => void
  onSave: () => void
  onStatsChange: (stats: MarkdownEditorStats) => void
  onTableOfContentsChange: (items: MarkdownTableOfContentsItem[]) => void
  renderedMode: boolean
  resolveImageSource: (href: string) => string | null
}

function applyEditorTextEdit(view: EditorView, edit: MarkdownTextEdit): void {
  view.dispatch({
    changes: {
      from: edit.from,
      insert: edit.insert,
      to: edit.to
    },
    selection:
      edit.selectionAnchor === undefined
        ? undefined
        : {
            anchor: edit.selectionAnchor,
            head: edit.selectionHead ?? edit.selectionAnchor
          },
    scrollIntoView: true
  })
  view.focus()
}

function runMarkdownCommand(
  view: EditorView | null,
  createEdit: (text: string, selection: { from: number; to: number }) => MarkdownTextEdit
): void {
  if (!view) return

  const text = view.state.doc.toString()
  const selection = view.state.selection.main
  const edit = createEdit(text, {
    from: selection.from,
    to: selection.to
  })

  applyEditorTextEdit(view, edit)
}

export const MarkdownEditor = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(
  function MarkdownEditor(
    {
      filePath,
      getInitialState,
      initialValue,
      onChange,
      onOpenLink,
      onOpenWikiLink,
      onPersistState,
      onSave,
      onStatsChange,
      onTableOfContentsChange,
      renderedMode,
      resolveImageSource
    },
    ref
  ): React.JSX.Element {
    const containerRef = useRef<HTMLDivElement | null>(null)
    const viewRef = useRef<EditorView | null>(null)
    const initialValueRef = useRef(initialValue)
    const callbacksRef = useRef({
      getInitialState,
      onChange,
      onOpenLink,
      onOpenWikiLink,
      onPersistState,
      onSave,
      onStatsChange,
      onTableOfContentsChange,
      resolveImageSource
    })
    callbacksRef.current = {
      getInitialState,
      onChange,
      onOpenLink,
      onOpenWikiLink,
      onPersistState,
      onSave,
      onStatsChange,
      onTableOfContentsChange,
      resolveImageSource
    }

    useImperativeHandle(
      ref,
      () => ({
        focus() {
          viewRef.current?.focus()
        },
        getValue() {
          return viewRef.current?.state.doc.toString() ?? initialValueRef.current
        },
        insertImage() {
          runMarkdownCommand(viewRef.current, (text, selection) =>
            insertMarkdownLink(text, selection, 'image')
          )
        },
        insertLink() {
          runMarkdownCommand(viewRef.current, (text, selection) =>
            insertMarkdownLink(text, selection, 'link')
          )
        },
        scrollToOffset(offset) {
          const view = viewRef.current
          if (!view) return

          const position = Math.max(0, Math.min(view.state.doc.length, offset))
          view.dispatch({
            effects: EditorView.scrollIntoView(position, { y: 'center' }),
            selection: {
              anchor: position
            }
          })
          view.focus()
        },
        toggleBold() {
          runMarkdownCommand(viewRef.current, (text, selection) =>
            toggleInlineMarkdown(text, selection, '**')
          )
        },
        toggleHeading(level) {
          runMarkdownCommand(viewRef.current, (text, selection) =>
            toggleHeading(text, selection, level)
          )
        },
        toggleItalic() {
          runMarkdownCommand(viewRef.current, (text, selection) =>
            toggleInlineMarkdown(text, selection, '*')
          )
        },
        toggleTaskList() {
          runMarkdownCommand(viewRef.current, toggleTaskList)
        }
      }),
      []
    )

    useEffect(() => {
      if (!containerRef.current) return

      const state = EditorState.create({
        doc: initialValueRef.current,
        extensions: [
          ...getCoreExtensions({
            onChange(value) {
              callbacksRef.current.onChange(value)
            },
            onSave() {
              callbacksRef.current.onSave()
            },
            onStatsChange(stats) {
              callbacksRef.current.onStatsChange(stats)
            },
            onTableOfContentsChange(items) {
              callbacksRef.current.onTableOfContentsChange(items)
            }
          }),
          ...getMarkdownExtensions(),
          ...(renderedMode
            ? [
                createMarkdownRenderExtension({
                  onOpenLink(href) {
                    callbacksRef.current.onOpenLink(href)
                  },
                  onOpenWikiLink(target) {
                    callbacksRef.current.onOpenWikiLink(target)
                  },
                  resolveImageSource(href) {
                    return callbacksRef.current.resolveImageSource(href)
                  }
                })
              ]
            : [])
        ]
      })
      const view = new EditorView({
        parent: containerRef.current,
        state
      })
      viewRef.current = view

      restoreMarkdownEditorState(view, callbacksRef.current.getInitialState?.(filePath))
      callbacksRef.current.onStatsChange(
        getMarkdownEditorStats(view.state.doc.toString(), view.state.selection.main.head)
      )
      callbacksRef.current.onTableOfContentsChange(extractMarkdownTableOfContents(view.state))

      return () => {
        callbacksRef.current.onPersistState(filePath, serializeMarkdownEditorState(filePath, view))
        view.destroy()
        if (viewRef.current === view) {
          viewRef.current = null
        }
      }
    }, [filePath, renderedMode])

    return <div ref={containerRef} className="markdown-editor-surface" />
  }
)

MarkdownEditor.displayName = 'MarkdownEditor'
