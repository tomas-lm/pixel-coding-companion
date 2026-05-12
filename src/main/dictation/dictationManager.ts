import { randomUUID } from 'crypto'
import { BrowserWindow, ipcMain } from 'electron'
import { mkdir, rm, writeFile } from 'fs/promises'
import { join } from 'path'
import type {
  DictationCaptureCommand,
  DictationCaptureResult,
  DictationInsertRequest,
  DictationInsertionResult,
  DictationSettings,
  DictationSnapshot
} from '../../shared/dictation'
import { DICTATION_CHANNELS } from '../../shared/dictation'
import { DictationController } from './dictationController'
import { ParakeetCoreMlBackend, type DictationBackend } from './dictationBackends'
import {
  getMicrophonePermissionSnapshot,
  openMicrophonePrivacySettings,
  requestMicrophonePermission
} from './dictationPermissions'
import { ModifierHoldShortcut, type ModifierHoldKeyEvent } from './modifierHoldShortcut'
import { NativeDictationRuntime } from './nativeDictationRuntime'
import { ParakeetModelInstaller } from './parakeetModelInstaller'

const MODIFIER_HOLD_DEBOUNCE_MS = 180

type DictationManagerOptions = {
  backend?: DictationBackend
  debounceMs?: number
  getAppPath?: () => string
  getResourcesPath?: () => string
  getUserDataPath?: () => string
  modelInstaller?: ParakeetModelInstaller
  nativeRuntime?: NativeDictationRuntime
}

export class DictationManager {
  private readonly controller: DictationController
  private readonly debounceMs: number
  private readonly getUserDataPath: () => string
  private readonly modelInstaller: ParakeetModelInstaller
  private readonly nativeRuntime: NativeDictationRuntime
  private readonly shortcut = new ModifierHoldShortcut()
  private pendingStartTimer: NodeJS.Timeout | null = null

  constructor({
    backend,
    debounceMs = MODIFIER_HOLD_DEBOUNCE_MS,
    getAppPath = () => process.cwd(),
    getResourcesPath = () => process.cwd(),
    getUserDataPath = () => process.cwd(),
    modelInstaller,
    nativeRuntime
  }: DictationManagerOptions = {}) {
    this.debounceMs = debounceMs
    this.getUserDataPath = getUserDataPath
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
      requestCaptureStart: () => this.sendCaptureCommand({ type: 'start' }),
      requestCaptureStop: () => this.sendCaptureCommand({ type: 'stop' }),
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
    ipcMain.handle(DICTATION_CHANNELS.completeCapture, (_, result: DictationCaptureResult) =>
      this.completeCapture(result)
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
    ipcMain.handle(DICTATION_CHANNELS.loadSnapshot, () => this.controller.getSnapshot())
    ipcMain.handle(DICTATION_CHANNELS.updateSettings, (_, settings: DictationSettings) =>
      this.controller.updateSettings(settings)
    )
    ipcMain.handle(DICTATION_CHANNELS.requestMicrophonePermission, () =>
      requestMicrophonePermission()
    )
    ipcMain.handle(DICTATION_CHANNELS.testTranscription, () => this.controller.testTranscription())
    ipcMain.on(DICTATION_CHANNELS.completeInsertion, (_, result: DictationInsertionResult) => {
      this.controller.reportInsertion(result)
    })
    ipcMain.on(DICTATION_CHANNELS.openMicrophoneSettings, () => {
      openMicrophonePrivacySettings()
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
    const targetWindow = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]

    if (!targetWindow || targetWindow.webContents.isDestroyed()) {
      this.controller.failRecording('Pixel has no available window for microphone capture.')
      return
    }

    targetWindow.webContents.send(DICTATION_CHANNELS.captureCommand, command)
  }
}
