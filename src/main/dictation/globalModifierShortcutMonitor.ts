import { createRequire } from 'module'
import type { DictationShortcutId } from '../../shared/dictation'
import type { ModifierHoldKeyEvent } from './modifierHoldShortcut'
import type { NativeDictationRuntime } from './nativeDictationRuntime'

const nodeRequire = createRequire(__filename)

type GlobalModifierShortcutMonitorOptions = {
  nativeRuntime: NativeDictationRuntime
  onEvent: (event: ModifierHoldKeyEvent) => void
  platform?: NodeJS.Platform
}

type ModifierSnapshot = {
  alt: boolean
  control: boolean
  meta: boolean
  shift: boolean
}

type NativeGlobalShortcutEvent = ModifierSnapshot & {
  keyCode: number
  type: number
}

type NativeGlobalShortcutAddon = {
  getNextEvent: () => NativeGlobalShortcutEvent | null
  isMonitoring: () => boolean
  startMonitoring: (shortcutMode: number) => boolean
  stopMonitoring: () => boolean
}

const NATIVE_EVENT_TYPES = {
  flagsChanged: 12,
  keyDown: 10,
  keyUp: 11
} as const

const SHORTCUT_MODES: Record<DictationShortcutId, number> = {
  'control-option-hold': 0,
  'control-shift-hold': 1,
  'option-shift-hold': 2
}

type NativeMonitorStartResult = 'started' | 'unavailable'

export class GlobalModifierShortcutMonitor {
  private readonly nativeRuntime: NativeDictationRuntime
  private readonly onEvent: (event: ModifierHoldKeyEvent) => void
  private readonly platform: NodeJS.Platform
  private activeShortcutId: DictationShortcutId | null = null
  private nativeAddon: NativeGlobalShortcutAddon | null = null
  private nativeAddonPollTimer: NodeJS.Timeout | null = null
  private previousNativeAddonModifiers: ModifierSnapshot = createModifierSnapshot()
  private hasWarnedUnavailable = false

  constructor({
    nativeRuntime,
    onEvent,
    platform = process.platform
  }: GlobalModifierShortcutMonitorOptions) {
    this.nativeRuntime = nativeRuntime
    this.onEvent = onEvent
    this.platform = platform
  }

  isRunning(): boolean {
    return this.nativeAddon !== null
  }

  observesCurrentAppEvents(): boolean {
    return false
  }

  start(shortcutId: DictationShortcutId): boolean {
    if (this.platform !== 'darwin') return false
    if (this.isRunning() && this.activeShortcutId === shortcutId) return true
    if (this.isRunning()) this.stop()

    const nativeAddonResult = this.startNativeAddonMonitor(shortcutId)
    if (nativeAddonResult === 'started') return true
    return false
  }

  stop(): void {
    this.activeShortcutId = null
    this.hasWarnedUnavailable = false
    this.stopNativeAddonMonitor()
  }

  private startNativeAddonMonitor(shortcutId: DictationShortcutId): NativeMonitorStartResult {
    const addon = this.loadNativeAddon()
    if (!addon) return 'unavailable'

    try {
      if (!addon.startMonitoring(SHORTCUT_MODES[shortcutId])) {
        this.warnUnavailable(shortcutId)
        return 'unavailable'
      }
      this.activeShortcutId = shortcutId
      this.hasWarnedUnavailable = false
      this.previousNativeAddonModifiers = createModifierSnapshot()
      this.nativeAddon = addon
      this.nativeAddonPollTimer = setInterval(() => {
        this.pollNativeAddonEvents()
      }, 16)
      this.nativeAddonPollTimer.unref?.()
      return 'started'
    } catch (error) {
      console.warn(
        'Pixel global dictation shortcut monitor could not start the native monitor.',
        error instanceof Error ? error.message : error
      )
      this.stopNativeAddonMonitor()
      return 'unavailable'
    }
  }

  private stopNativeAddonMonitor(): void {
    if (this.nativeAddonPollTimer) {
      clearInterval(this.nativeAddonPollTimer)
      this.nativeAddonPollTimer = null
    }
    if (!this.nativeAddon) return

    const addon = this.nativeAddon
    this.nativeAddon = null
    this.activeShortcutId = null
    if (addon.isMonitoring()) {
      try {
        addon.stopMonitoring()
      } catch (error) {
        console.warn(
          'Pixel global dictation shortcut monitor could not stop cleanly.',
          error instanceof Error ? error.message : error
        )
      }
    }
  }

  private loadNativeAddon(): NativeGlobalShortcutAddon | null {
    const addonPath = this.nativeRuntime.getGlobalShortcutAddonPath()
    if (!addonPath) return null

    try {
      return nodeRequire(addonPath) as NativeGlobalShortcutAddon
    } catch (error) {
      console.warn(
        'Pixel global dictation shortcut monitor could not load the native monitor.',
        error instanceof Error ? error.message : error
      )
      return null
    }
  }

  private warnUnavailable(shortcutId: DictationShortcutId): void {
    if (this.hasWarnedUnavailable) return

    this.hasWarnedUnavailable = true
    console.warn(
      `Pixel global dictation shortcut monitor: could not start monitor for shortcut ${shortcutId}.`
    )
  }

  private pollNativeAddonEvents(): void {
    if (!this.nativeAddon) return

    for (
      let event = this.nativeAddon.getNextEvent();
      event;
      event = this.nativeAddon.getNextEvent()
    ) {
      const output = makeNativeAddonShortcutEvent(event, this.previousNativeAddonModifiers)
      this.previousNativeAddonModifiers = createModifierSnapshot(event)
      if (output) this.onEvent(output)
    }
  }
}

function makeNativeAddonShortcutEvent(
  event: NativeGlobalShortcutEvent,
  previousModifiers: ModifierSnapshot
): ModifierHoldKeyEvent | null {
  const modifiers = createModifierSnapshot(event)

  if (event.type === NATIVE_EVENT_TYPES.flagsChanged) {
    const key =
      modifierKeyNameForKeyCode(event.keyCode) ??
      changedModifierKey(previousModifiers, modifiers) ??
      'Modifier'

    return {
      alt: modifiers.alt,
      control: modifiers.control,
      key,
      meta: modifiers.meta,
      shift: modifiers.shift,
      type: isModifierPressed(key, modifiers) ? 'keyDown' : 'keyUp'
    }
  }

  if (event.type === NATIVE_EVENT_TYPES.keyDown || event.type === NATIVE_EVENT_TYPES.keyUp) {
    return {
      alt: modifiers.alt,
      control: modifiers.control,
      key: keyNameForKeyCode(event.keyCode),
      meta: modifiers.meta,
      shift: modifiers.shift,
      type: event.type === NATIVE_EVENT_TYPES.keyUp ? 'keyUp' : 'keyDown'
    }
  }

  return null
}

function createModifierSnapshot(modifiers: Partial<ModifierSnapshot> = {}): ModifierSnapshot {
  return {
    alt: Boolean(modifiers.alt),
    control: Boolean(modifiers.control),
    meta: Boolean(modifiers.meta),
    shift: Boolean(modifiers.shift)
  }
}

function keyNameForKeyCode(keyCode: number): string {
  return modifierKeyNameForKeyCode(keyCode) ?? `Key${keyCode}`
}

function modifierKeyNameForKeyCode(keyCode: number): string | null {
  switch (keyCode) {
    case 0x38:
    case 0x3c:
      return 'Shift'
    case 0x3b:
    case 0x3e:
      return 'Control'
    case 0x3a:
    case 0x3d:
      return 'Alt'
    case 0x37:
    case 0x36:
      return 'Meta'
    default:
      return null
  }
}

function changedModifierKey(
  previousModifiers: ModifierSnapshot,
  currentModifiers: ModifierSnapshot
): string | null {
  if (previousModifiers.control !== currentModifiers.control) return 'Control'
  if (previousModifiers.alt !== currentModifiers.alt) return 'Alt'
  if (previousModifiers.shift !== currentModifiers.shift) return 'Shift'
  if (previousModifiers.meta !== currentModifiers.meta) return 'Meta'
  return null
}

function isModifierPressed(key: string, modifiers: ModifierSnapshot): boolean {
  switch (key) {
    case 'Control':
      return modifiers.control
    case 'Alt':
      return modifiers.alt
    case 'Shift':
      return modifiers.shift
    case 'Meta':
      return modifiers.meta
    default:
      return modifiers.alt || modifiers.control || modifiers.meta || modifiers.shift
  }
}
