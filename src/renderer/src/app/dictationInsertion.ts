import type { DictationInsertTarget } from '../../../shared/dictation'

const TEXT_INPUT_TYPES = new Set(['', 'email', 'password', 'search', 'tel', 'text', 'url'])

function dispatchInputEvent(target: HTMLElement): void {
  target.dispatchEvent(new Event('input', { bubbles: true }))
}

function isTextInput(element: Element): element is HTMLInputElement {
  return element instanceof HTMLInputElement && TEXT_INPUT_TYPES.has(element.type)
}

function isInsideTerminalSurface(element: Element): boolean {
  return Boolean(element.closest('.terminal-surface'))
}

function getFocusedTextTarget(documentRef: Document): HTMLElement | null {
  const activeElement = documentRef.activeElement
  if (!activeElement) return null
  if (isInsideTerminalSurface(activeElement)) return null

  if (isTextInput(activeElement) || activeElement instanceof HTMLTextAreaElement) {
    return activeElement
  }

  if (activeElement instanceof HTMLElement && activeElement.isContentEditable) {
    return activeElement
  }

  return activeElement instanceof HTMLElement
    ? (activeElement.closest('[contenteditable="true"], .cm-content') as HTMLElement | null)
    : null
}

export function insertTextIntoFocusedPixelTarget(
  text: string,
  documentRef: Document = document
): boolean {
  const target = getFocusedTextTarget(documentRef)
  if (!target) return false

  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    const selectionStart = target.selectionStart ?? target.value.length
    const selectionEnd = target.selectionEnd ?? selectionStart
    target.setRangeText(text, selectionStart, selectionEnd, 'end')
    dispatchInputEvent(target)
    return true
  }

  target.focus()
  if (documentRef.execCommand?.('insertText', false, text)) {
    dispatchInputEvent(target)
    return true
  }

  target.textContent = `${target.textContent ?? ''}${text}`
  dispatchInputEvent(target)
  return true
}

type InsertDictationTranscriptOptions = {
  allowPixelTargets?: boolean
  documentRef?: Document
  terminalSessionId?: string
  writeClipboard: (text: string) => void
  writeTerminal?: (request: { data: string; id: string }) => void
}

export function insertDictationTranscript(
  text: string,
  {
    allowPixelTargets = true,
    documentRef = document,
    terminalSessionId,
    writeClipboard,
    writeTerminal
  }: InsertDictationTranscriptOptions
): DictationInsertTarget {
  if (allowPixelTargets && insertTextIntoFocusedPixelTarget(text, documentRef)) {
    return 'pixel_text'
  }

  if (allowPixelTargets && terminalSessionId && writeTerminal) {
    writeTerminal({
      data: text,
      id: terminalSessionId
    })
    return 'terminal'
  }

  writeClipboard(text)
  return 'clipboard'
}
