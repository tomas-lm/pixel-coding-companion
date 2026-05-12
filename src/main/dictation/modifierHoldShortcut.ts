import type { DictationModifier, DictationShortcutId } from '../../shared/dictation'
import { getDictationShortcutOption } from '../../shared/dictation'

type ModifierKeyEventType = 'keyDown' | 'keyUp'

export type ModifierHoldKeyEvent = {
  alt: boolean
  control: boolean
  key: string
  meta: boolean
  shift: boolean
  type: ModifierKeyEventType
}

export type ModifierHoldAction =
  | { type: 'none' }
  | { type: 'cancel_pending_start' }
  | { type: 'schedule_start' }
  | { type: 'stop_recording' }

const MODIFIER_KEY_NAMES: Record<DictationModifier, string[]> = {
  alt: ['Alt', 'AltLeft', 'AltRight', 'Option'],
  control: ['Control', 'ControlLeft', 'ControlRight'],
  meta: ['Meta', 'MetaLeft', 'MetaRight', 'Command'],
  shift: ['Shift', 'ShiftLeft', 'ShiftRight']
}

function isModifierDown(event: ModifierHoldKeyEvent, modifier: DictationModifier): boolean {
  return event[modifier]
}

function isKeyForModifier(key: string, modifier: DictationModifier): boolean {
  return MODIFIER_KEY_NAMES[modifier].includes(key)
}

function isShortcutModifierKey(key: string, shortcutId: DictationShortcutId): boolean {
  const shortcut = getDictationShortcutOption(shortcutId)

  return shortcut.modifiers.some((modifier) => isKeyForModifier(key, modifier))
}

function isShortcutActive(event: ModifierHoldKeyEvent, shortcutId: DictationShortcutId): boolean {
  const shortcut = getDictationShortcutOption(shortcutId)

  return (Object.keys(MODIFIER_KEY_NAMES) as DictationModifier[]).every((modifier) => {
    const shouldBeDown = shortcut.modifiers.includes(modifier)

    return isModifierDown(event, modifier) === shouldBeDown
  })
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

  update(
    event: ModifierHoldKeyEvent,
    shortcutId: DictationShortcutId = 'control-option-hold'
  ): ModifierHoldAction {
    const shortcutActive = isShortcutActive(event, shortcutId)

    if (
      event.type === 'keyDown' &&
      shortcutActive &&
      !isShortcutModifierKey(event.key, shortcutId)
    ) {
      this.chordCancelled = true
      if (this.isPendingStart) {
        this.isPendingStart = false
        return { type: 'cancel_pending_start' }
      }
      return { type: 'none' }
    }

    if (!shortcutActive) {
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
      isShortcutModifierKey(event.key, shortcutId)
    ) {
      this.isPendingStart = true
      return { type: 'schedule_start' }
    }

    return { type: 'none' }
  }
}
