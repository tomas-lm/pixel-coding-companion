import { randomUUID } from 'crypto'
import { BrowserWindow, globalShortcut, ipcMain } from 'electron'
import { mkdir, rm, writeFile } from 'fs/promises'
import { join } from 'path'
import type {
  DictationCaptureCommand,
  DictationCaptureResult,
  DictationInsertRequest,
  DictationInsertionResult,
  DictationModelInstallSnapshot,
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
import {
  getMicrophonePermissionSnapshot,
  openMicrophonePrivacySettings,
  requestMicrophonePermission
} from './dictationPermissions'
import { ModifierHoldShortcut, type ModifierHoldKeyEvent } from './modifierHoldShortcut'
import { NativeDictationRuntime } from './nativeDictationRuntime'
import { ParakeetModelInstaller } from './parakeetModelInstaller'
import { SherpaOnnxModelInstaller } from './sherpaOnnxModelInstaller'
import { SherpaOnnxRuntime } from './sherpaOnnxRuntime'

const MODIFIER_HOLD_DEBOUNCE_MS = 180

type DictationGlobalShortcut = Pick<typeof globalShortcut, 'register' | 'unregister'>
type DictationWindowRegistry = Pick<typeof BrowserWindow, 'getAllWindows' | 'getFocusedWindow'>

type DictationManagerOptions = {
  backend?: DictationBackend
  browserWindows?: DictationWindowRegistry
  debounceMs?: number
  electronGlobalShortcut?: DictationGlobalShortcut
  getAppPath?: () => string
  getResourcesPath?: () => string
  getUserDataPath?: () => string
  modelInstaller?: DictationModelInstaller
  nativeRuntime?: NativeDictationRuntime
  platform?: NodeJS.Platform
  sherpaOnnxRuntime?: SherpaOnnxRuntime
}

type DictationModelInstaller = {
  getSnapshot: () => DictationModelInstallSnapshot
  install: () => Promise<DictationModelInstallSnapshot>
}

export class DictationManager {
  private readonly controller: DictationController
  private readonly debounceMs: number
  private readonly browserWindows: DictationWindowRegistry
  private readonly electronGlobalShortcut: DictationGlobalShortcut
  private readonly getUserDataPath: () => string
  private readonly modelInstaller: DictationModelInstaller
  private readonly nativeRuntime: NativeDictationRuntime
  private readonly platform: NodeJS.Platform
  private readonly sherpaOnnxRuntime: SherpaOnnxRuntime
  private readonly shortcut = new ModifierHoldShortcut()
  private globalShortcutAccelerator: string | null = null
  private linuxShortcutAvailability: DictationShortcutAvailability = {
    mode: 'hold',
    scope: 'focused'
  }
  private pendingStartTimer: NodeJS.Timeout | null = null

  constructor({
    backend,
    browserWindows = BrowserWindow,
    debounceMs = MODIFIER_HOLD_DEBOUNCE_MS,
    electronGlobalShortcut = globalShortcut,
    getAppPath = () => process.cwd(),
    getResourcesPath = () => process.cwd(),
    getUserDataPath = () => process.cwd(),
    modelInstaller,
    nativeRuntime,
    platform = process.platform,
    sherpaOnnxRuntime
  }: DictationManagerOptions = {}) {
    this.browserWindows = browserWindows
    this.debounceMs = debounceMs
    this.electronGlobalShortcut = electronGlobalShortcut
    this.getUserDataPath = getUserDataPath
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
        platform,
        onChange: () => this.broadcastSnapshot(this.controller.getSnapshot())
      })
    this.nativeRuntime =
      nativeRuntime ??
      new NativeDictationRuntime({
        getAppPath,
        getResourcesPath
      })
    this.sherpaOnnxRuntime = sherpaOnnxRuntime ?? new SherpaOnnxRuntime()
    const resolvedBackend = backend ?? this.createPlatformBackend()
    this.controller = new DictationController({
      backend: resolvedBackend,
      emitSnapshot: (snapshot) => this.broadcastSnapshot(snapshot),
      getModelSnapshot: () => this.modelInstaller.getSnapshot(),
      getShortcutAvailability: () => this.getShortcutAvailability(),
      requestCaptureStart: () => this.sendCaptureCommand({ type: 'start' }),
      requestCaptureStop: () => this.sendCaptureCommand({ type: 'stop' }),
      requestInsertion: (request) => this.requestInsertion(request)
    })
  }

  attachWindow(window: BrowserWindow): void {
    window.webContents.on('before-input-event', (event, input) => {
      const snapshot = this.controller.getSnapshot()
      if (!snapshot.settings.enabled) return

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
    ipcMain.handle(DICTATION_CHANNELS.updateSettings, (_, settings: DictationSettings) => {
      const snapshot = this.controller.updateSettings(settings)
      this.syncGlobalShortcut()
      return snapshot
    })
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
    this.syncGlobalShortcut()
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
    for (const window of this.browserWindows.getAllWindows()) {
      if (!window.webContents.isDestroyed()) {
        window.webContents.send(DICTATION_CHANNELS.state, snapshot)
      }
    }
  }

  private requestInsertion(request: DictationInsertRequest): void {
    const targetWindow = this.browserWindows.getFocusedWindow() ?? this.browserWindows.getAllWindows()[0]

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
    const targetWindow = this.browserWindows.getFocusedWindow() ?? this.browserWindows.getAllWindows()[0]

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
}

function createModelInstaller({
  getUserDataPath,
  platform,
  onChange
}: {
  getUserDataPath: () => string
  platform: NodeJS.Platform
  onChange: () => void
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
