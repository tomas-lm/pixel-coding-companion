import { mkdtemp, readFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { describe, expect, it, vi } from 'vitest'
import { DICTATION_CHANNELS, type DictationBackendStatus } from '../../shared/dictation'
import { DictationManager } from './dictationManager'
import type { DictationBackend } from './dictationBackends'

type TestManagerAccess = {
  controller: {
    getSnapshot: () => {
      shortcutAvailability: unknown
      state: string
    }
    recordingStartedAt: number
    startRecording: () => Promise<{ state: string }>
    stopRecording: () => Promise<{ state: string }>
    updateSettings: (settings: {
      enabled: boolean
      keepAudioHistory: boolean
      keepLastAudioSample: boolean
      keepTranscriptHistory: boolean
      overlayEnabled: boolean
      shortcutId: 'control-option-hold' | 'control-shift-hold' | 'option-shift-hold'
    }) => void
  }
  syncGlobalShortcut: () => void
}

function readyStatus(): DictationBackendStatus {
  return {
    available: true,
    id: 'onnx-sherpa',
    label: 'Parakeet ONNX',
    ready: true,
    status: 'ready'
  }
}

function createBackend(): DictationBackend {
  return {
    id: 'onnx-sherpa',
    getStatus: () => readyStatus(),
    transcribe: vi.fn()
  }
}

function createModelInstaller() {
  return {
    getSnapshot: () => ({
      downloadedBytes: 0,
      installPath: '/tmp/parakeet-onnx',
      percent: 100,
      requiredBytesLabel: '~350 MB',
      sourceUrl:
        'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8.tar.bz2',
      status: 'installed' as const,
      totalBytes: 367_000_000
    }),
    install: vi.fn()
  }
}

function createWindow() {
  const beforeInputEventHandlers: Array<
    (
      event: {
        preventDefault: ReturnType<typeof vi.fn>
      },
      input: {
        alt: boolean
        control: boolean
        isAutoRepeat: boolean
        key: string
        meta: boolean
        shift: boolean
        type: 'keyDown' | 'keyUp'
      }
    ) => void
  > = []
  const closedHandlers: Array<() => void> = []
  const send = vi.fn()

  return {
    beforeInputEventHandlers,
    closedHandlers,
    window: {
      on: vi.fn((event: string, handler: () => void) => {
        if (event === 'closed') closedHandlers.push(handler)
      }),
      webContents: {
        isDestroyed: vi.fn(() => false),
        on: vi.fn((event: string, handler: (event: { preventDefault: () => void }, input: never) => void) => {
          if (event === 'before-input-event') {
            beforeInputEventHandlers.push(handler as never)
          }
        }),
        send
      }
    }
  }
}

function createManager({
  registerReturns = true
}: {
  registerReturns?: boolean
} = {}) {
  const browserWindow = createWindow()
  const register = vi.fn((_accelerator: string, callback: () => void) => {
    createManagerState.globalShortcutCallback = callback
    return registerReturns
  })
  const unregister = vi.fn()

  const manager = new DictationManager({
    backend: createBackend(),
    browserWindows: {
      getAllWindows: () => [browserWindow.window as never],
      getFocusedWindow: () => browserWindow.window as never
    },
    electronGlobalShortcut: {
      register,
      unregister
    },
    getMainWindow: () => browserWindow.window as never,
    modelInstaller: createModelInstaller(),
    platform: 'linux'
  })

  manager.attachWindow(browserWindow.window as never)
  const privateManager = manager as unknown as TestManagerAccess
  privateManager.controller.updateSettings({
    enabled: true,
    keepAudioHistory: false,
    keepLastAudioSample: false,
    keepTranscriptHistory: true,
    overlayEnabled: false,
    shortcutId: 'control-option-hold'
  })
  privateManager.syncGlobalShortcut()

  return {
    browserWindow,
    manager,
    privateManager,
    register,
    unregister
  }
}

const createManagerState: {
  globalShortcutCallback: null | (() => void)
} = {
  globalShortcutCallback: null
}

describe('DictationManager Linux shortcuts', () => {
  it('registers the selected Linux shortcut globally', () => {
    const { privateManager, register } = createManager()

    expect(register).toHaveBeenCalledWith('CommandOrControl+Alt+Space', expect.any(Function))
    expect(privateManager.controller.getSnapshot().shortcutAvailability).toEqual({
      mode: 'toggle',
      scope: 'global'
    })
  })

  it('pressing the global shortcut once starts recording and twice stops', async () => {
    const { browserWindow, privateManager } = createManager()

    await createManagerState.globalShortcutCallback?.()
    expect(privateManager.controller.getSnapshot().state).toBe('recording')
    expect(browserWindow.window.webContents.send).toHaveBeenCalledWith(
      DICTATION_CHANNELS.captureCommand,
      { type: 'start' }
    )

    privateManager.controller.recordingStartedAt = Date.now() - 1_000
    await createManagerState.globalShortcutCallback?.()
    expect(privateManager.controller.getSnapshot().state).toBe('transcribing')
    expect(browserWindow.window.webContents.send).toHaveBeenCalledWith(
      DICTATION_CHANNELS.captureCommand,
      { type: 'stop' }
    )
  })

  it('changing the shortcut updates global registration', () => {
    const { privateManager, register, unregister } = createManager()

    privateManager.controller.updateSettings({
      enabled: true,
      keepAudioHistory: false,
      keepLastAudioSample: false,
      keepTranscriptHistory: true,
      overlayEnabled: false,
      shortcutId: 'control-shift-hold'
    })
    privateManager.syncGlobalShortcut()

    expect(unregister).toHaveBeenCalledWith('CommandOrControl+Alt+Space')
    expect(register).toHaveBeenLastCalledWith('CommandOrControl+Shift+Space', expect.any(Function))
  })

  it('disabling dictation unregisters the Linux shortcut', () => {
    const { privateManager, unregister } = createManager()

    privateManager.controller.updateSettings({
      enabled: false,
      keepAudioHistory: false,
      keepLastAudioSample: false,
      keepTranscriptHistory: true,
      overlayEnabled: false,
      shortcutId: 'control-option-hold'
    })
    privateManager.syncGlobalShortcut()

    expect(unregister).toHaveBeenCalledWith('CommandOrControl+Alt+Space')
  })

  it('falls back to focused-window Linux shortcuts when global registration fails', async () => {
    const { browserWindow, privateManager, register } = createManager({ registerReturns: false })
    const preventDefault = vi.fn()

    expect(register).toHaveBeenCalledOnce()
    expect(privateManager.controller.getSnapshot().shortcutAvailability).toMatchObject({
      mode: 'toggle',
      scope: 'focused'
    })

    browserWindow.beforeInputEventHandlers[0](
      { preventDefault },
      {
        alt: true,
        control: true,
        isAutoRepeat: false,
        key: 'Space',
        meta: false,
        shift: false,
        type: 'keyDown'
      }
    )

    expect(preventDefault).toHaveBeenCalledOnce()
    expect(privateManager.controller.getSnapshot().state).toBe('recording')
    expect(browserWindow.window.webContents.send).toHaveBeenCalledWith(
      DICTATION_CHANNELS.captureCommand,
      { type: 'start' }
    )

    privateManager.controller.recordingStartedAt = Date.now() - 1_000
    browserWindow.beforeInputEventHandlers[0](
      { preventDefault: vi.fn() },
      {
        alt: true,
        control: true,
        isAutoRepeat: false,
        key: 'Space',
        meta: false,
        shift: false,
        type: 'keyDown'
      }
    )

    expect(privateManager.controller.getSnapshot().state).toBe('transcribing')
    expect(browserWindow.window.webContents.send).toHaveBeenCalledWith(
      DICTATION_CHANNELS.captureCommand,
      { type: 'stop' }
    )
  })
})

describe('DictationManager completeCapture', () => {
  it('decodes base64 audio payloads before transcription', async () => {
    const userDataPath = await mkdtemp(join(tmpdir(), 'pixel-dictation-manager-'))
    const browserWindow = createWindow()
    const expectedAudio = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0x10, 0x20, 0x30, 0x40])
    const transcribe = vi.fn(
      async ({
        audioFilePath
      }: {
        audioFilePath?: string
        startedAt: number
        stoppedAt: number
      }) => {
        if (!audioFilePath) throw new Error('Missing audio file path in transcription request.')

        const savedAudio = await readFile(audioFilePath)

        expect(savedAudio.equals(Buffer.from(expectedAudio))).toBe(true)

        return {
          backend: 'onnx-sherpa' as const,
          durationMs: 1_000,
          text: 'decoded transcript'
        }
      }
    )

    const manager = new DictationManager({
      backend: {
        ...createBackend(),
        transcribe
      },
      browserWindows: {
        getAllWindows: () => [browserWindow.window as never],
        getFocusedWindow: () => browserWindow.window as never
      },
      getMainWindow: () => browserWindow.window as never,
      getUserDataPath: () => userDataPath,
      modelInstaller: createModelInstaller(),
      platform: 'linux'
    })
    manager.attachWindow(browserWindow.window as never)
    const privateManager = manager as unknown as TestManagerAccess & {
      completeCapture: (result: {
        audioBase64: string
        mimeType: 'audio/wav'
        ok: true
        sampleRate: number
      }) => Promise<{ state: string }>
    }

    privateManager.controller.updateSettings({
      enabled: true,
      keepAudioHistory: false,
      keepLastAudioSample: false,
      keepTranscriptHistory: true,
      overlayEnabled: false,
      shortcutId: 'control-option-hold'
    })
    await privateManager.controller.startRecording()
    privateManager.controller.recordingStartedAt = Date.now() - 1_000
    await privateManager.controller.stopRecording()

    const snapshot = await privateManager.completeCapture({
      audioBase64: Buffer.from(expectedAudio).toString('base64'),
      mimeType: 'audio/wav',
      ok: true,
      sampleRate: 16_000
    })

    expect(transcribe).toHaveBeenCalledOnce()
    expect(snapshot.state).toBe('inserting')
  })

  it('still accepts legacy ArrayBuffer capture payloads', async () => {
    const userDataPath = await mkdtemp(join(tmpdir(), 'pixel-dictation-manager-'))
    const browserWindow = createWindow()
    const expectedAudio = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0xaa, 0xbb, 0xcc, 0xdd])
    const transcribe = vi.fn(
      async ({
        audioFilePath
      }: {
        audioFilePath?: string
        startedAt: number
        stoppedAt: number
      }) => {
        if (!audioFilePath) throw new Error('Missing audio file path in transcription request.')

        const savedAudio = await readFile(audioFilePath)

        expect(savedAudio.equals(Buffer.from(expectedAudio))).toBe(true)

        return {
          backend: 'onnx-sherpa' as const,
          durationMs: 1_000,
          text: 'decoded transcript'
        }
      }
    )

    const manager = new DictationManager({
      backend: {
        ...createBackend(),
        transcribe
      },
      browserWindows: {
        getAllWindows: () => [browserWindow.window as never],
        getFocusedWindow: () => browserWindow.window as never
      },
      getMainWindow: () => browserWindow.window as never,
      getUserDataPath: () => userDataPath,
      modelInstaller: createModelInstaller(),
      platform: 'linux'
    })
    manager.attachWindow(browserWindow.window as never)
    const privateManager = manager as unknown as TestManagerAccess & {
      completeCapture: (result: {
        audioData: ArrayBuffer
        mimeType: 'audio/wav'
        ok: true
        sampleRate: number
      }) => Promise<{ state: string }>
    }

    privateManager.controller.updateSettings({
      enabled: true,
      keepAudioHistory: false,
      keepLastAudioSample: false,
      keepTranscriptHistory: true,
      overlayEnabled: false,
      shortcutId: 'control-option-hold'
    })
    await privateManager.controller.startRecording()
    privateManager.controller.recordingStartedAt = Date.now() - 1_000
    await privateManager.controller.stopRecording()

    const snapshot = await privateManager.completeCapture({
      audioData: expectedAudio.buffer.slice(0),
      mimeType: 'audio/wav',
      ok: true,
      sampleRate: 16_000
    })

    expect(transcribe).toHaveBeenCalledOnce()
    expect(snapshot.state).toBe('inserting')
  })
})
