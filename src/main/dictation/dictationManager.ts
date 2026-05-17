import { randomUUID } from 'crypto'
import { BrowserWindow, globalShortcut, ipcMain } from 'electron'
import { mkdir, rm, writeFile } from 'fs/promises'
import { join } from 'path'
import type {
  DictationCaptureCommand,
  DictationCaptureResult,
  DictationExternalInsertRequest,
  DictationInsertRequest,
  DictationInsertionResult,
  DictationModelInstallSnapshot,
  DictationOverlayMoveRequest,
  DictationShortcutAvailability,
  DictationShortcutId,
  DictationSettings,
  DictationSnapshot
} from '../../shared/dictation'
import { DICTATION_CHANNELS } from '../../shared/dictation'
import { DictationController } from './dictationController'
import {
  MockDictationBackend,
  ParakeetCoreMlBackend,
  SherpaOnnxBackend,
  type DictationBackend
} from './dictationBackends'
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
import { SherpaOnnxModelInstaller } from './sherpaOnnxModelInstaller'
import { SherpaOnnxRuntime } from './sherpaOnnxRuntime'

const MODIFIER_HOLD_DEBOUNCE_MS = 180
const GLOBAL_SHORTCUT_RETRY_MS = 3000

type DictationGlobalShortcut = Pick<typeof globalShortcut, 'register' | 'unregister'>
type DictationWindowRegistry = Pick<typeof BrowserWindow, 'getAllWindows' | 'getFocusedWindow'>

type DictationModelInstaller = {
  getSnapshot: () => DictationModelInstallSnapshot
  install: () => Promise<DictationModelInstallSnapshot>
}

type DictationManagerOptions = {
  backend?: DictationBackend
  browserWindows?: DictationWindowRegistry
  debounceMs?: number
  electronGlobalShortcut?: DictationGlobalShortcut
  getAppPath?: () => string
  getMainWindow?: () => BrowserWindow | null
  getResourcesPath?: () => string
  getUserDataPath?: () => string
  historyStore?: DictationHistoryStore
  modelInstaller?: DictationModelInstaller
  nativeRuntime?: NativeDictationRuntime
  overlayManager?: DictationOverlayManager
  platform?: NodeJS.Platform
  sherpaOnnxRuntime?: SherpaOnnxRuntime
}

export class DictationManager {
  private readonly controller: DictationController
  private readonly debounceMs: number
  private readonly browserWindows: DictationWindowRegistry
  private readonly electronGlobalShortcut: DictationGlobalShortcut
  private readonly getMainWindow: () => BrowserWindow | null
  private readonly getUserDataPath: () => string
  private readonly historyStore: DictationHistoryStore
  private readonly globalShortcutMonitor: GlobalModifierShortcutMonitor
  private readonly modelInstaller: DictationModelInstaller
  private readonly nativeRuntime: NativeDictationRuntime
  private readonly overlayManager?: DictationOverlayManager
  private readonly platform: NodeJS.Platform
  private readonly sherpaOnnxRuntime: SherpaOnnxRuntime
  private readonly shortcut = new ModifierHoldShortcut()
  private globalShortcutAccelerator: string | null = null
  private linuxShortcutAvailability: DictationShortcutAvailability = {
    mode: 'hold',
    scope: 'focused'
  }
  private globalShortcutRetryTimer: NodeJS.Timeout | null = null
  private hasReportedGlobalShortcutPermissionError = false
  private pendingStartTimer: NodeJS.Timeout | null = null

  constructor({
    backend,
    browserWindows = BrowserWindow,
    debounceMs = MODIFIER_HOLD_DEBOUNCE_MS,
    electronGlobalShortcut = globalShortcut,
    getAppPath = () => process.cwd(),
    getMainWindow = () => BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0],
    getResourcesPath = () => process.cwd(),
    getUserDataPath = () => process.cwd(),
    historyStore,
    modelInstaller,
    nativeRuntime,
    overlayManager,
    platform = process.platform,
    sherpaOnnxRuntime
  }: DictationManagerOptions = {}) {
    this.browserWindows = browserWindows
    this.debounceMs = debounceMs
    this.electronGlobalShortcut = electronGlobalShortcut
    this.getMainWindow = getMainWindow
    this.getUserDataPath = getUserDataPath
    this.historyStore = historyStore ?? new DictationHistoryStore({ getUserDataPath })
    this.overlayManager = overlayManager
    this.platform = platform
    if (platform === 'linux') {
      this.linuxShortcutAvailability = {
        mode: 'toggle',
        scope: 'global'
      }
    }
    this.modelInstaller =
      modelInstaller ??
      createModelInstaller({
        getUserDataPath,
        onChange: () => this.broadcastSnapshot(this.controller.getSnapshot()),
        platform
      })
    this.nativeRuntime =
      nativeRuntime ??
      new NativeDictationRuntime({
        getAppPath,
        getResourcesPath
      })
    this.sherpaOnnxRuntime = sherpaOnnxRuntime ?? new SherpaOnnxRuntime()
    this.globalShortcutMonitor = new GlobalModifierShortcutMonitor({
      nativeRuntime: this.nativeRuntime,
      onEvent: (event) => this.handleShortcutEvent(event),
      platform
    })

    const resolvedBackend = backend ?? this.createPlatformBackend()
    this.controller = new DictationController({
      backend: resolvedBackend,
      emitSnapshot: (snapshot) => this.broadcastSnapshot(snapshot),
      getModelSnapshot: () => this.modelInstaller.getSnapshot(),
      getShortcutAvailability: () => this.getShortcutAvailability(),
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
    window.webContents.on('before-input-event', (event, input) => {
      const snapshot = this.controller.getSnapshot()
      if (!snapshot.settings.enabled) return
      if (
        this.globalShortcutMonitor.isRunning() &&
        this.globalShortcutMonitor.observesCurrentAppEvents()
      ) {
        return
      }

      if (this.platform === 'linux') {
        if (
          snapshot.shortcutAvailability.mode === 'toggle' &&
          snapshot.shortcutAvailability.scope === 'focused' &&
          isLinuxShortcutEvent(input, snapshot.settings.shortcutId)
        ) {
          event.preventDefault()
          void this.handleLinuxToggleShortcut()
        }
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
      this.syncGlobalShortcut()
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
    this.syncGlobalShortcut()
    this.syncGlobalShortcutMonitor(this.controller.getSnapshot().settings.enabled)
  }

  stop(): void {
    this.globalShortcutMonitor.stop()
    this.clearGlobalShortcutRetry()
    this.hasReportedGlobalShortcutPermissionError = false
    this.clearPendingStart()
    this.shortcut.reset()
    if (this.globalShortcutAccelerator) {
      this.electronGlobalShortcut.unregister(this.globalShortcutAccelerator)
      this.globalShortcutAccelerator = null
    }
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
    if (this.platform === 'linux') return

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
    for (const window of this.browserWindows.getAllWindows()) {
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
    const focusedWindow = this.browserWindows.getFocusedWindow()

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
    await writeFile(audioFilePath, this.decodeCaptureAudio(result))

    try {
      return await this.controller.completeRecording({ audioFilePath })
    } finally {
      if (!this.controller.getSnapshot().settings.keepLastAudioSample) {
        await rm(audioFilePath, { force: true })
      }
    }
  }

  private decodeCaptureAudio(result: Extract<DictationCaptureResult, { ok: true }>): Buffer {
    if (typeof result.audioBase64 === 'string' && result.audioBase64.length > 0) {
      return Buffer.from(result.audioBase64, 'base64')
    }

    if (result.audioData instanceof ArrayBuffer) {
      return Buffer.from(result.audioData)
    }

    throw new TypeError('Dictation capture payload did not include serializable audio data.')
  }

  private sendCaptureCommand(command: DictationCaptureCommand): void {
    const targetWindow = this.getMainProcessTargetWindow()

    if (!targetWindow || targetWindow.webContents.isDestroyed()) {
      this.controller.failRecording('Pixel has no available window for microphone capture.')
      return
    }

    targetWindow.webContents.send(DICTATION_CHANNELS.captureCommand, command)
  }

  private createPlatformBackend(): DictationBackend {
    if (this.platform === 'linux') {
      return new SherpaOnnxBackend({
        getModelSnapshot: () => this.modelInstaller.getSnapshot(),
        platform: this.platform,
        runtime: this.sherpaOnnxRuntime
      })
    }

    if (this.platform === 'darwin') {
      return new ParakeetCoreMlBackend({
        getModelSnapshot: () => this.modelInstaller.getSnapshot(),
        platform: this.platform,
        runtime: this.nativeRuntime
      })
    }

    return new MockDictationBackend()
  }

  private syncGlobalShortcut(): void {
    if (this.platform !== 'linux') return

    if (this.globalShortcutAccelerator) {
      this.electronGlobalShortcut.unregister(this.globalShortcutAccelerator)
      this.globalShortcutAccelerator = null
    }

    const snapshot = this.controller.getSnapshot()
    if (!snapshot.settings.enabled) return

    const accelerator = getLinuxShortcutAccelerator(snapshot.settings.shortcutId)
    const registered = this.tryRegisterLinuxShortcut(accelerator)
    if (registered) {
      this.globalShortcutAccelerator = accelerator
      this.linuxShortcutAvailability = {
        mode: 'toggle',
        scope: 'global'
      }
      this.broadcastSnapshot(this.controller.getSnapshot())
      return
    }

    this.linuxShortcutAvailability = {
      message: getLinuxShortcutFallbackMessage(snapshot.shortcut),
      mode: 'toggle',
      scope: 'focused'
    }
    this.broadcastSnapshot(this.controller.getSnapshot())
  }

  private getShortcutAvailability(): DictationShortcutAvailability {
    if (this.platform === 'linux') return this.linuxShortcutAvailability

    return {
      mode: 'hold',
      scope: 'focused'
    }
  }

  private tryRegisterLinuxShortcut(accelerator: string): boolean {
    try {
      return this.electronGlobalShortcut.register(accelerator, () => {
        void this.handleLinuxToggleShortcut()
      })
    } catch {
      return false
    }
  }

  private async handleLinuxToggleShortcut(): Promise<void> {
    const snapshot = this.controller.getSnapshot()

    if (snapshot.state === 'recording') {
      await this.controller.stopRecording()
      return
    }

    if (snapshot.state === 'idle' || snapshot.state === 'error') {
      await this.controller.startRecording()
    }
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
      this.browserWindows
        .getAllWindows()
        .find(
          (window) =>
            !window.webContents.isDestroyed() && !this.overlayManager?.isOverlayWindow(window)
        ) ?? null
    )
  }
}

function createModelInstaller({
  getUserDataPath,
  onChange,
  platform
}: {
  getUserDataPath: () => string
  onChange: () => void
  platform: NodeJS.Platform
}): DictationModelInstaller {
  if (platform === 'linux') {
    return new SherpaOnnxModelInstaller({
      getUserDataPath,
      onChange
    })
  }

  return new ParakeetModelInstaller({
    getUserDataPath,
    onChange
  })
}

function getLinuxShortcutAccelerator(shortcutId: DictationShortcutId): string {
  if (shortcutId === 'control-shift-hold') return 'CommandOrControl+Shift+Space'
  if (shortcutId === 'option-shift-hold') return 'Alt+Shift+Space'

  return 'CommandOrControl+Alt+Space'
}

function getLinuxShortcutFallbackMessage(shortcut: string): string {
  return `Pixel could not register ${shortcut} as a global Linux shortcut. Another app or desktop session may already be using it, so the bind will work while Pixel is focused.`
}

function isLinuxShortcutEvent(
  input: Pick<
    Electron.Input,
    'alt' | 'control' | 'isAutoRepeat' | 'key' | 'meta' | 'shift' | 'type'
  >,
  shortcutId: DictationShortcutId
): boolean {
  if (input.type !== 'keyDown' || input.isAutoRepeat) return false

  const isSpace = input.key === ' ' || input.key.toLowerCase() === 'space'
  if (!isSpace || input.meta) return false

  if (shortcutId === 'control-shift-hold') {
    return input.control && input.shift && !input.alt
  }

  if (shortcutId === 'option-shift-hold') {
    return input.alt && input.shift && !input.control
  }

  return input.control && input.alt && !input.shift
}
