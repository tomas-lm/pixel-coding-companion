const SHIFT_ENTER_CSI_U_SEQUENCE = '\x1b[13;2u'

export function handleTerminalKeyEvent(
  event: KeyboardEvent,
  writeData: (data: string) => void
): boolean {
  if (!isPlainShiftEnter(event)) return true

  event.preventDefault()
  event.stopPropagation()
  writeData(SHIFT_ENTER_CSI_U_SEQUENCE)
  return false
}

function isPlainShiftEnter(event: KeyboardEvent): boolean {
  return (
    event.type === 'keydown' &&
    event.key === 'Enter' &&
    event.shiftKey &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.isComposing
  )
}
