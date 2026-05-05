import { closeBrackets, completionKeymap } from '@codemirror/autocomplete'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search'
import type { Extension } from '@codemirror/state'
import { EditorView, keymap, type ViewUpdate } from '@codemirror/view'
import { getMarkdownEditorStats, type MarkdownEditorStats } from './markdownStats'
import { extractMarkdownTableOfContents, type MarkdownTableOfContentsItem } from './markdownToc'

export type MarkdownEditorExtensionEvents = {
  onChange: (value: string) => void
  onSave: () => void
  onStatsChange: (stats: MarkdownEditorStats) => void
  onTableOfContentsChange: (items: MarkdownTableOfContentsItem[]) => void
}

function emitDocumentState(update: ViewUpdate, events: MarkdownEditorExtensionEvents): void {
  const value = update.state.doc.toString()
  const cursor = update.state.selection.main.head

  if (update.docChanged) {
    events.onChange(value)
    events.onTableOfContentsChange(extractMarkdownTableOfContents(update.state))
  }

  if (update.docChanged || update.selectionSet) {
    events.onStatsChange(getMarkdownEditorStats(value, cursor))
  }
}

export const markdownTheme = EditorView.theme(
  {
    '&': {
      height: '100%',
      minHeight: '0',
      background: 'transparent',
      color: 'var(--ev-c-text-1)'
    },
    '.cm-content': {
      minHeight: '100%',
      padding: '22px 26px 40px',
      caretColor: 'color-mix(in srgb, var(--active-project-color) 72%, white)',
      fontFamily: 'ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, monospace',
      fontSize: '14px',
      lineHeight: '1.65'
    },
    '.cm-focused': {
      outline: 'none'
    },
    '.cm-gutters': {
      borderRight: '1px solid rgba(255, 255, 255, 0.08)',
      background: 'rgba(255, 255, 255, 0.02)',
      color: 'var(--ev-c-text-3)'
    },
    '.cm-line': {
      padding: '0 2px'
    },
    '.cm-scroller': {
      height: '100%',
      overflow: 'auto'
    },
    '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
      background: 'color-mix(in srgb, var(--active-project-color) 30%, transparent)'
    }
  },
  {
    dark: true
  }
)

export function getCoreExtensions(events: MarkdownEditorExtensionEvents): Extension[] {
  return [
    history(),
    closeBrackets(),
    highlightSelectionMatches(),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    markdownTheme,
    EditorView.lineWrapping,
    EditorView.updateListener.of((update) => emitDocumentState(update, events)),
    keymap.of([
      {
        key: 'Mod-s',
        preventDefault: true,
        run() {
          events.onSave()
          return true
        }
      },
      ...historyKeymap,
      ...searchKeymap,
      ...completionKeymap,
      ...defaultKeymap
    ])
  ]
}

export function getMarkdownExtensions(): Extension[] {
  return [markdown()]
}
