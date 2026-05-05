import { syntaxTree } from '@codemirror/language'
import { RangeSetBuilder } from '@codemirror/state'
import {
  Decoration,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
  type EditorView,
  type ViewUpdate
} from '@codemirror/view'

export type MarkdownRenderLink = {
  from: number
  href: string
  image: boolean
  label: string
  to: number
}

export type MarkdownRenderTask = {
  checked: boolean
  from: number
  to: number
}

export type MarkdownRenderWikiLink = {
  from: number
  label: string
  target: string
  to: number
}

export type MarkdownRendererOptions = {
  onOpenLink: (href: string) => void
  onOpenWikiLink: (target: string) => void
  resolveImageSource: (href: string) => string | null
}

type DecorationRange = {
  decoration: Decoration
  from: number
  to: number
}

export function findTaskMarkers(lineText: string, lineFrom = 0): MarkdownRenderTask[] {
  const tasks: MarkdownRenderTask[] = []
  const taskRegex = /(^|\s)([-*+]\s+)\[([ xX])\]/g
  let match: RegExpExecArray | null

  while ((match = taskRegex.exec(lineText))) {
    const from = lineFrom + match.index + match[1].length + match[2].length
    tasks.push({
      checked: match[3].toLowerCase() === 'x',
      from,
      to: from + 3
    })
  }

  return tasks
}

export function findWikiLinks(lineText: string, lineFrom = 0): MarkdownRenderWikiLink[] {
  const links: MarkdownRenderWikiLink[] = []
  const wikiRegex = /\[\[([^\]\n|]+)(?:\|([^\]\n]+))?\]\]/g
  let match: RegExpExecArray | null

  while ((match = wikiRegex.exec(lineText))) {
    const target = match[1].trim()
    if (!target) continue

    links.push({
      from: lineFrom + match.index,
      label: (match[2] ?? target).trim(),
      target,
      to: lineFrom + match.index + match[0].length
    })
  }

  return links
}

export function findMarkdownLinks(lineText: string, lineFrom = 0): MarkdownRenderLink[] {
  const links: MarkdownRenderLink[] = []
  const linkRegex = /(!?)\[([^\]\n]+)\]\(([^)\n]+)\)/g
  let match: RegExpExecArray | null

  while ((match = linkRegex.exec(lineText))) {
    links.push({
      from: lineFrom + match.index,
      href: match[3].trim(),
      image: match[1] === '!',
      label: match[2].trim(),
      to: lineFrom + match.index + match[0].length
    })
  }

  return links
}

export function shouldRenderDecoratedRange(
  selectionRanges: readonly { empty: boolean; from: number; to: number }[],
  from: number,
  to: number
): boolean {
  return !selectionRanges.some((range) => {
    if (range.empty) return range.from >= from && range.from <= to

    return range.from < to && range.to > from
  })
}

class TaskCheckboxWidget extends WidgetType {
  constructor(private readonly checked: boolean) {
    super()
  }

  eq(widget: TaskCheckboxWidget): boolean {
    return widget.checked === this.checked
  }

  toDOM(): HTMLElement {
    const checkbox = document.createElement('input')
    checkbox.className = 'cm-md-task-checkbox'
    checkbox.type = 'checkbox'
    checkbox.checked = this.checked
    checkbox.disabled = true

    return checkbox
  }
}

class LinkWidget extends WidgetType {
  constructor(
    private readonly className: string,
    private readonly label: string,
    private readonly onOpen: () => void
  ) {
    super()
  }

  eq(widget: LinkWidget): boolean {
    return widget.className === this.className && widget.label === this.label
  }

  toDOM(): HTMLElement {
    const button = document.createElement('button')
    button.className = this.className
    button.type = 'button'
    button.textContent = this.label
    button.addEventListener('mousedown', (event) => event.preventDefault())
    button.addEventListener('click', (event) => {
      event.preventDefault()
      this.onOpen()
    })

    return button
  }
}

class ImageWidget extends WidgetType {
  constructor(
    private readonly alt: string,
    private readonly href: string,
    private readonly src: string | null
  ) {
    super()
  }

  eq(widget: ImageWidget): boolean {
    return widget.alt === this.alt && widget.href === this.href && widget.src === this.src
  }

  toDOM(): HTMLElement {
    const figure = document.createElement('figure')
    figure.className = 'cm-md-image-widget'

    if (this.src) {
      const image = document.createElement('img')
      image.alt = this.alt
      image.src = this.src
      figure.append(image)
    }

    const caption = document.createElement('figcaption')
    caption.textContent = this.alt || this.href
    figure.append(caption)

    return figure
  }
}

class HorizontalRuleWidget extends WidgetType {
  toDOM(): HTMLElement {
    const rule = document.createElement('hr')
    rule.className = 'cm-md-horizontal-rule'

    return rule
  }
}

function addLineClass(
  view: EditorView,
  ranges: DecorationRange[],
  from: number,
  className: string
): void {
  const line = view.state.doc.lineAt(from)
  ranges.push({
    decoration: Decoration.line({ class: className }),
    from: line.from,
    to: line.from
  })
}

function addSyntaxTreeDecorations(view: EditorView, ranges: DecorationRange[]): void {
  const selectionRanges = view.state.selection.ranges

  for (const visibleRange of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from: visibleRange.from,
      to: visibleRange.to,
      enter(node) {
        const parent = node.node.parent
        const parentFrom = parent?.from ?? node.from
        const parentTo = parent?.to ?? node.to
        const shouldHide = shouldRenderDecoratedRange(selectionRanges, parentFrom, parentTo)

        if (/^ATXHeading[1-6]$/.test(node.name)) {
          const level = Number(node.name.at(-1))
          addLineClass(view, ranges, node.from, `cm-md-heading-line cm-md-heading-${level}`)
          return
        }

        if (node.name === 'FencedCode') {
          addLineClass(view, ranges, node.from, 'cm-md-code-block-line')
          return
        }

        if (node.name === 'Blockquote') {
          addLineClass(view, ranges, node.from, 'cm-md-blockquote-line')
          return
        }

        if (node.name === 'HorizontalRule' && shouldHide) {
          ranges.push({
            decoration: Decoration.replace({
              widget: new HorizontalRuleWidget()
            }),
            from: node.from,
            to: node.to
          })
          return
        }

        if (shouldHide && ['CodeMark', 'HeaderMark', 'LinkMark', 'QuoteMark'].includes(node.name)) {
          ranges.push({
            decoration: Decoration.mark({ class: 'cm-md-syntax-hidden' }),
            from: node.from,
            to: node.to
          })
        }
      }
    })
  }
}

function addInlineDecorations(
  view: EditorView,
  ranges: DecorationRange[],
  options: MarkdownRendererOptions
): void {
  const selectionRanges = view.state.selection.ranges
  const visitedLines = new Set<number>()

  for (const visibleRange of view.visibleRanges) {
    let position = visibleRange.from

    while (position <= visibleRange.to && position <= view.state.doc.length) {
      const line = view.state.doc.lineAt(position)
      if (!visitedLines.has(line.number)) {
        visitedLines.add(line.number)
        const lineText = line.text

        for (const task of findTaskMarkers(lineText, line.from)) {
          if (shouldRenderDecoratedRange(selectionRanges, task.from, task.to)) {
            ranges.push({
              decoration: Decoration.replace({
                widget: new TaskCheckboxWidget(task.checked)
              }),
              from: task.from,
              to: task.to
            })
          }
        }

        for (const link of findMarkdownLinks(lineText, line.from)) {
          if (!shouldRenderDecoratedRange(selectionRanges, link.from, link.to)) continue

          ranges.push({
            decoration: Decoration.replace({
              widget: link.image
                ? new ImageWidget(link.label, link.href, options.resolveImageSource(link.href))
                : new LinkWidget('cm-md-link-widget', link.label, () =>
                    options.onOpenLink(link.href)
                  )
            }),
            from: link.from,
            to: link.to
          })
        }

        for (const link of findWikiLinks(lineText, line.from)) {
          if (!shouldRenderDecoratedRange(selectionRanges, link.from, link.to)) continue

          ranges.push({
            decoration: Decoration.replace({
              widget: new LinkWidget('cm-md-wiki-link-widget', link.label, () =>
                options.onOpenWikiLink(link.target)
              )
            }),
            from: link.from,
            to: link.to
          })
        }
      }

      position = line.to + 1
      if (position === line.from) break
    }
  }
}

function buildMarkdownDecorations(
  view: EditorView,
  options: MarkdownRendererOptions
): DecorationSet {
  if (view.hasFocus) return Decoration.none

  const ranges: DecorationRange[] = []
  addSyntaxTreeDecorations(view, ranges)
  addInlineDecorations(view, ranges, options)
  ranges.sort((left, right) => left.from - right.from || left.to - right.to)

  const builder = new RangeSetBuilder<Decoration>()
  for (const range of ranges) {
    builder.add(range.from, range.to, range.decoration)
  }

  return builder.finish()
}

export function createMarkdownRenderExtension(options: MarkdownRendererOptions): ViewPlugin<{
  decorations: DecorationSet
  update: (update: ViewUpdate) => void
}> {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet

      constructor(view: EditorView) {
        this.decorations = buildMarkdownDecorations(view, options)
      }

      update(update: ViewUpdate): void {
        if (
          update.docChanged ||
          update.selectionSet ||
          update.viewportChanged ||
          update.focusChanged
        ) {
          this.decorations = buildMarkdownDecorations(update.view, options)
        }
      }
    },
    {
      decorations: (plugin) => plugin.decorations
    }
  )
}
