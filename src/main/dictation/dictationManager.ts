import { randomUUID } from 'crypto'
import { BrowserWindow, ipcMain } from 'electron'
import { mkdir, rm, writeFile } from 'fs/promises'
import { join } from 'path'
import type {
  DictationCaptureCommand,
  DictationCaptureResult,
  DictationExternalInsertRequest,
  DictationInsertRequest,
  DictationInsertionResult,
  DictationOverlayMoveRequest,
  DictationSettings,
  DictationSnapshot
} from '../../shared/dictation'
import { DICTATION_CHANNELS } from '../../shared/dictation'
import { DictationController } from './dictationController'
import { ParakeetCoreMlBackend, type DictationBackend } from './dictationBackends'
import { DictationHistoryStore } from './dictationHistoryStore'
import type { DictationOverlayManager } from './dictationOverlayManager'
import {
  getMicrophonePermissionSnapshot,
  openMicrophonePrivacySettings,
  requestMicrophonePermission
} from './dictationPermissions'
import { insertTextIntoActiveApplication } from './externalTextInsertion'
import { GlobalModifierShortcutMonitor } from './globalModifierShortcutMonitor'
import { ModifierHoldShortcut, type ModifierHoldKeyEvent } from './modifierHoldShortcut'
import { NativeDictationRuntime } from './nativeDictationRuntime'
import { ParakeetModelInstaller } from './parakeetModelInstaller'

const MODIFIER_HOLD_DEBOUNCE_MS = 180
const GLOBAL_SHORTCUT_RETRY_MS = 3000

type DictationManagerOptions = {
  backend?: DictationBackend
  debounceMs?: number
  getAppPath?: () => string
  getMainWindow?: () => BrowserWindow | null
  getResourcesPath?: () => string
  getUserDataPath?: () => string
  historyStore?: DictationHistoryStore
  modelInstaller?: ParakeetModelInstaller
  nativeRuntime?: NativeDictationRuntime
  overlayManager?: DictationOverlayManager
}

export class DictationManager {
  private readonly controller: DictationController
  private readonly debounceMs: number
  private readonly getMainWindow: () => BrowserWindow | null
  private readonly getUserDataPath: () => string
  private readonly historyStore: DictationHistoryStore
  private readonly globalShortcutMonitor: GlobalModifierShortcutMonitor
  private readonly modelInstaller: ParakeetModelInstaller
  private readonly nativeRuntime: NativeDictationRuntime
  private readonly overlayManager?: DictationOverlayManager
  private readonly shortcut = new ModifierHoldShortcut()
  private globalShortcutRetryTimer: NodeJS.Timeout | null = null
  private hasReportedGlobalShortcutPermissionError = false
  private pendingStartTimer: NodeJS.Timeout | null = null

  constructor({
    backend,
    debounceMs = MODIFIER_HOLD_DEBOUNCE_MS,
    getAppPath = () => process.cwd(),
    getMainWindow = () => BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0],
    getResourcesPath = () => process.cwd(),
    getUserDataPath = () => process.cwd(),
    historyStore,
    modelInstaller,
    nativeRuntime,
    overlayManager
  }: DictationManagerOptions = {}) {
    this.debounceMs = debounceMs
    this.getMainWindow = getMainWindow
    this.getUserDataPath = getUserDataPath
    this.historyStore = historyStore ?? new DictationHistoryStore({ getUserDataPath })
    this.overlayManager = overlayManager
    this.modelInstaller =
      modelInstaller ??
      new ParakeetModelInstaller({
        getUserDataPath,
        onChange: () => this.broadcastSnapshot(this.controller.getSnapshot())
      })
    this.nativeRuntime =
      nativeRuntime ??
      new NativeDictationRuntime({
        getAppPath,
        getResourcesPath
      })
    this.globalShortcutMonitor = new GlobalModifierShortcutMonitor({
      nativeRuntime: this.nativeRuntime,
      onEvent: (event) => this.handleShortcutEvent(event)
    })
    const resolvedBackend =
      backend ??
      new ParakeetCoreMlBackend({
        getModelSnapshot: () => this.modelInstaller.getSnapshot(),
        runtime: this.nativeRuntime
      })
    this.controller = new DictationController({
      backend: resolvedBackend,
      emitSnapshot: (snapshot) => this.broadcastSnapshot(snapshot),
      getModelSnapshot: () => this.modelInstaller.getSnapshot(),
      recordTranscript: async (request) => {
        await this.historyStore.recordTranscript(request)
      },
      requestCaptureStart: () => this.sendCaptureCommand({ type: 'start' }),
      requestCaptureStop: () => this.sendCaptureCommand({ type: 'stop' }),
      requestInsertion: (request) => this.requestInsertion(request),
      reportInsertionResult: (result) => {
        void this.historyStore.updateInsertionTarget(result.transcriptId, result.target)
      }
    })
  }

  attachWindow(window: BrowserWindow): void {
    window.webContents.on('before-input-event', (_, input) => {
      const snapshot = this.controller.getSnapshot()
      if (!snapshot.settings.enabled) return
      if (
        this.globalShortcutMonitor.isRunning() &&
        this.globalShortcutMonitor.observesCurrentAppEvents()
      ) {
        return
      }

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
    ipcMain.handle(DICTATION_CHANNELS.completeCapture, (_, result: DictationCaptureResult) =>
      this.completeCapture(result)
    )
    ipcMain.handle(DICTATION_CHANNELS.clearHistory, () => this.historyStore.clearHistory())
    ipcMain.handle(DICTATION_CHANNELS.deleteHistoryEntry, (_, request: { id: string }) =>
      this.historyStore.deleteEntry(request.id)
    )
    ipcMain.handle(DICTATION_CHANNELS.getMicrophonePermission, () =>
      getMicrophonePermissionSnapshot()
    )
    ipcMain.handle(DICTATION_CHANNELS.installModel, async () => {
      await this.modelInstaller.install()
      const snapshot = this.controller.getSnapshot()
      this.broadcastSnapshot(snapshot)
      return snapshot
    })
    ipcMain.handle(
      DICTATION_CHANNELS.insertExternalText,
      (_, request: DictationExternalInsertRequest) =>
        insertTextIntoActiveApplication(request.text, { nativeRuntime: this.nativeRuntime })
    )
    ipcMain.handle(DICTATION_CHANNELS.listHistory, (_, request) =>
      this.historyStore.listHistory(request)
    )
    ipcMain.handle(DICTATION_CHANNELS.loadStats, () => this.historyStore.getStats())
    ipcMain.handle(DICTATION_CHANNELS.loadSnapshot, () => this.controller.getSnapshot())
    ipcMain.handle(DICTATION_CHANNELS.updateSettings, async (_, settings: DictationSettings) => {
      const snapshot = this.controller.updateSettings(settings)
      this.syncGlobalShortcutMonitor(snapshot.settings.enabled)
      await this.overlayManager?.setEnabled(settings.overlayEnabled)
      return snapshot
    })
    ipcMain.handle(DICTATION_CHANNELS.requestMicrophonePermission, () =>
      requestMicrophonePermission()
    )
    ipcMain.handle(DICTATION_CHANNELS.testTranscription, () => this.controller.testTranscription())
    ipcMain.handle(DICTATION_CHANNELS.toggleRecording, () => this.toggleRecording())
    ipcMain.on(DICTATION_CHANNELS.completeInsertion, (_, result: DictationInsertionResult) => {
      this.controller.reportInsertion(result)
    })
    ipcMain.on(DICTATION_CHANNELS.openMicrophoneSettings, () => {
      openMicrophonePrivacySettings()
    })
    ipcMain.on(DICTATION_CHANNELS.openAudioSettings, () => {
      this.overlayManager?.openAudioSettings()
    })
    ipcMain.on(DICTATION_CHANNELS.openMainWindow, () => {
      this.overlayManager?.openMainWindow()
    })
    ipcMain.on(DICTATION_CHANNELS.finishOverlayDrag, () => {
      this.overlayManager?.finishDrag()
    })
    ipcMain.on(DICTATION_CHANNELS.moveOverlay, (_, request: DictationOverlayMoveRequest) => {
      this.overlayManager?.moveBy(request)
    })
    ipcMain.on(DICTATION_CHANNELS.setOverlayExpanded, (_, expanded: boolean) => {
      this.overlayManager?.setExpanded(Boolean(expanded))
    })
  }

  stop(): void {
    this.globalShortcutMonitor.stop()
    this.clearGlobalShortcutRetry()
    this.hasReportedGlobalShortcutPermissionError = false
    this.clearPendingStart()
    this.shortcut.reset()
  }

  private toggleRecording(): Promise<DictationSnapshot> {
    const snapshot = this.controller.getSnapshot()
    if (snapshot.state === 'recording') return this.controller.stopRecording()
    if (snapshot.state === 'idle' || snapshot.state === 'error') {
      return this.controller.startRecording()
    }

    return Promise.resolve(snapshot)
  }

  private handleShortcutEvent(event: ModifierHoldKeyEvent): void {
    const action = this.shortcut.update(event, this.controller.getShortcutId())

    if (action.type === 'schedule_start') {
      this.clearPendingStart()
      this.overlayManager?.presentOnActiveDisplay()
      this.pendingStartTimer = setTimeout(() => {
        this.pendingStartTimer = null
        if (this.shortcut.commitPendingStart()) {
          this.overlayManager?.presentOnActiveDisplay()
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
      this.overlayManager?.presentOnActiveDisplay()
      void this.controller.stopRecording()
    }
  }

  private syncGlobalShortcutMonitor(enabled: boolean): void {
    this.clearGlobalShortcutRetry()
    if (!enabled) {
      this.globalShortcutMonitor.stop()
      this.hasReportedGlobalShortcutPermissionError = false
      return
    }

    if (this.globalShortcutMonitor.start(this.controller.getShortcutId())) {
      this.hasReportedGlobalShortcutPermissionError = false
      return
    }

    if (!this.hasReportedGlobalShortcutPermissionError) {
      this.hasReportedGlobalShortcutPermissionError = true
      this.controller.failRecording(
        'Pixel could not start the global dictation bind monitor. Restart Pixel and confirm macOS Accessibility permission if the bind does not fire.'
      )
    }
    this.globalShortcutRetryTimer = setTimeout(() => {
      this.globalShortcutRetryTimer = null
      if (this.controller.getSnapshot().settings.enabled) {
        this.syncGlobalShortcutMonitor(true)
      }
    }, GLOBAL_SHORTCUT_RETRY_MS)
    this.globalShortcutRetryTimer.unref?.()
  }

  private clearGlobalShortcutRetry(): void {
    if (!this.globalShortcutRetryTimer) return

    clearTimeout(this.globalShortcutRetryTimer)
    this.globalShortcutRetryTimer = null
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
    if (this.shouldInsertIntoActiveExternalApp()) {
      void this.requestExternalInsertion(request)
      return
    }

    const targetWindow = this.getMainProcessTargetWindow()

    if (!targetWindow || targetWindow.webContents.isDestroyed()) {
      void this.requestExternalInsertion(request)
      return
    }

    targetWindow.webContents.send(DICTATION_CHANNELS.insertTranscript, request)
  }

  private shouldInsertIntoActiveExternalApp(): boolean {
    const focusedWindow = BrowserWindow.getFocusedWindow()

    return !focusedWindow || Boolean(this.overlayManager?.isOverlayWindow(focusedWindow))
  }

  private async requestExternalInsertion(request: DictationInsertRequest): Promise<void> {
    try {
      const result = await insertTextIntoActiveApplication(request.transcript.text, {
        nativeRuntime: this.nativeRuntime
      })
      this.controller.reportInsertion({
        ok: result.ok,
        reason: result.reason,
        target: result.target,
        transcriptId: request.transcriptId
      })
    } catch (error) {
      this.controller.reportInsertion({
        ok: false,
        reason:
          error instanceof Error ? error.message : 'Could not paste transcript outside Pixel.',
        target: 'clipboard',
        transcriptId: request.transcriptId
      })
    }
  }

  private async completeCapture(result: DictationCaptureResult): Promise<DictationSnapshot> {
    if (!result.ok) return this.controller.failRecording(result.reason)

    const capturesDirectory = join(this.getUserDataPath(), 'dictation', 'captures')
    await mkdir(capturesDirectory, { recursive: true })

    const audioFilePath = join(capturesDirectory, `${Date.now()}-${randomUUID()}.wav`)
    await writeFile(audioFilePath, Buffer.from(result.audioData))

    try {
      return await this.controller.completeRecording({ audioFilePath })
    } finally {
      if (!this.controller.getSnapshot().settings.keepLastAudioSample) {
        await rm(audioFilePath, { force: true })
      }
    }
  }

  private sendCaptureCommand(command: DictationCaptureCommand): void {
    const targetWindow = this.getMainProcessTargetWindow()

    if (!targetWindow || targetWindow.webContents.isDestroyed()) {
      this.controller.failRecording('Pixel has no available window for microphone capture.')
      return
    }

    targetWindow.webContents.send(DICTATION_CHANNELS.captureCommand, command)
  }

  private getMainProcessTargetWindow(): BrowserWindow | null {
    const preferredWindow = this.getMainWindow()
    if (
      preferredWindow &&
      !preferredWindow.webContents.isDestroyed() &&
      !this.overlayManager?.isOverlayWindow(preferredWindow)
    ) {
      return preferredWindow
    }

    return (
      BrowserWindow.getAllWindows().find(
        (window) =>
          !window.webContents.isDestroyed() && !this.overlayManager?.isOverlayWindow(window)
      ) ?? null
    )
  }
}
