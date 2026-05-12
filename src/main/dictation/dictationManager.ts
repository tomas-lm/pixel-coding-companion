import { BrowserWindow, ipcMain } from 'electron'
import type {
  DictationInsertRequest,
  DictationInsertionResult,
  DictationSettings,
  DictationSnapshot
} from '../../shared/dictation'
import { DICTATION_CHANNELS } from '../../shared/dictation'
import { DictationController } from './dictationController'
import { MockDictationBackend, type DictationBackend } from './dictationBackends'
import { ModifierHoldShortcut, type ModifierHoldKeyEvent } from './modifierHoldShortcut'

const MODIFIER_HOLD_DEBOUNCE_MS = 180

type DictationManagerOptions = {
  backend?: DictationBackend
  debounceMs?: number
}

export class DictationManager {
  private readonly controller: DictationController
  private readonly debounceMs: number
  private readonly shortcut = new ModifierHoldShortcut()
  private pendingStartTimer: NodeJS.Timeout | null = null

  constructor({
    backend = new MockDictationBackend(),
    debounceMs = MODIFIER_HOLD_DEBOUNCE_MS
  }: DictationManagerOptions = {}) {
    this.debounceMs = debounceMs
    this.controller = new DictationController({
      backend,
      emitSnapshot: (snapshot) => this.broadcastSnapshot(snapshot),
      requestInsertion: (request) => this.requestInsertion(request)
    })
  }

  attachWindow(window: BrowserWindow): void {
    window.webContents.on('before-input-event', (_, input) => {
      const snapshot = this.controller.getSnapshot()
      if (!snapshot.settings.enabled) return

      this.handleShortcutEvent({
        alt: input.alt,
        control: input.control,
        key: input.key,
        meta: input.meta,
        shift: input.shift,
        type: input.type === 'keyUp' ? 'keyUp' : 'keyDown'
      })
    })

    window.on('closed', () => {
      this.clearPendingStart()
      this.shortcut.reset()
    })
  }

  registerIpc(): void {
    ipcMain.handle(DICTATION_CHANNELS.loadSnapshot, () => this.controller.getSnapshot())
    ipcMain.handle(DICTATION_CHANNELS.updateSettings, (_, settings: DictationSettings) =>
      this.controller.updateSettings(settings)
    )
    ipcMain.handle(DICTATION_CHANNELS.testTranscription, () => this.controller.testTranscription())
    ipcMain.on(DICTATION_CHANNELS.completeInsertion, (_, result: DictationInsertionResult) => {
      this.controller.reportInsertion(result)
    })
  }

  private handleShortcutEvent(event: ModifierHoldKeyEvent): void {
    const action = this.shortcut.update(event, this.controller.getShortcutId())

    if (action.type === 'schedule_start') {
      this.clearPendingStart()
      this.pendingStartTimer = setTimeout(() => {
        this.pendingStartTimer = null
        if (this.shortcut.commitPendingStart()) {
          void this.controller.startRecording()
        }
      }, this.debounceMs)
      return
    }

    if (action.type === 'cancel_pending_start') {
      this.clearPendingStart()
      return
    }

    if (action.type === 'stop_recording') {
      this.clearPendingStart()
      void this.controller.stopRecording()
    }
  }

  private clearPendingStart(): void {
    if (!this.pendingStartTimer) return

    clearTimeout(this.pendingStartTimer)
    this.pendingStartTimer = null
  }

  private broadcastSnapshot(snapshot: DictationSnapshot): void {
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.webContents.isDestroyed()) {
        window.webContents.send(DICTATION_CHANNELS.state, snapshot)
      }
    }
  }

  private requestInsertion(request: DictationInsertRequest): void {
    const targetWindow = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]

    if (!targetWindow || targetWindow.webContents.isDestroyed()) {
      this.controller.reportInsertion({
        ok: false,
        reason: 'Pixel has no available window for transcript insertion.',
        target: 'clipboard',
        transcriptId: request.transcriptId
      })
      return
    }

    targetWindow.webContents.send(DICTATION_CHANNELS.insertTranscript, request)
  }
}
