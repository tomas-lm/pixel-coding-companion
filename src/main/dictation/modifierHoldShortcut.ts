type ModifierKeyEventType = 'keyDown' | 'keyUp'

export type ModifierHoldKeyEvent = {
  alt: boolean
  control: boolean
  key: string
  type: ModifierKeyEventType
}

export type ModifierHoldAction =
  | { type: 'none' }
  | { type: 'cancel_pending_start' }
  | { type: 'schedule_start' }
  | { type: 'stop_recording' }

function isControlKey(key: string): boolean {
  return key === 'Control' || key === 'ControlLeft' || key === 'ControlRight'
}

function isOptionKey(key: string): boolean {
  return key === 'Alt' || key === 'AltLeft' || key === 'AltRight' || key === 'Option'
}

function isModifierKey(key: string): boolean {
  return isControlKey(key) || isOptionKey(key) || key === 'Meta' || key === 'Shift'
}

export class ModifierHoldShortcut {
  private chordCancelled = false
  private isPendingStart = false
  private isRecording = false

  commitPendingStart(): boolean {
    if (!this.isPendingStart || this.chordCancelled) return false

    this.isPendingStart = false
    this.isRecording = true
    return true
  }

  reset(): void {
    this.chordCancelled = false
    this.isPendingStart = false
    this.isRecording = false
  }

  update(event: ModifierHoldKeyEvent): ModifierHoldAction {
    const controlAndOptionDown = event.control && event.alt

    if (event.type === 'keyDown' && controlAndOptionDown && !isModifierKey(event.key)) {
      this.chordCancelled = true
      if (this.isPendingStart) {
        this.isPendingStart = false
        return { type: 'cancel_pending_start' }
      }
      return { type: 'none' }
    }

    if (!controlAndOptionDown) {
      this.chordCancelled = false
      if (this.isPendingStart) {
        this.isPendingStart = false
        return { type: 'cancel_pending_start' }
      }
      if (this.isRecording) {
        this.isRecording = false
        return { type: 'stop_recording' }
      }
      return { type: 'none' }
    }

    if (
      event.type === 'keyDown' &&
      !this.isRecording &&
      !this.isPendingStart &&
      !this.chordCancelled &&
      (isControlKey(event.key) || isOptionKey(event.key))
    ) {
      this.isPendingStart = true
      return { type: 'schedule_start' }
    }

    return { type: 'none' }
  }
}
