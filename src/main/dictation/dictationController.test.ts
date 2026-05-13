import { afterEach, describe, expect, it, vi } from 'vitest'
import type {
  DictationBackendStatus,
  DictationInsertRequest,
  DictationSnapshot,
  DictationTranscript
} from '../../shared/dictation'
import { DictationController } from './dictationController'
import type { DictationBackend } from './dictationBackends'

afterEach(() => {
  vi.useRealTimers()
})

const enabledSettings = {
  enabled: true,
  keepAudioHistory: false,
  keepLastAudioSample: false,
  keepTranscriptHistory: true,
  overlayEnabled: false,
  shortcutId: 'control-option-hold' as const
}

function readyStatus(): DictationBackendStatus {
  return {
    available: true,
    id: 'mock',
    label: 'Mock local backend',
    ready: true,
    status: 'ready'
  }
}

function createBackend({
  status = readyStatus(),
  transcribe = async ({ startedAt, stoppedAt }) => ({
    backend: 'mock',
    durationMs: stoppedAt - startedAt,
    language: 'en',
    text: 'hello pixel'
  })
}: {
  status?: DictationBackendStatus
  transcribe?: DictationBackend['transcribe']
} = {}): DictationBackend {
  return {
    id: 'mock',
    getStatus: () => status,
    transcribe
  }
}

function createController(
  backend = createBackend(),
  options: { minRecordingMs?: number } = {}
): {
  controller: DictationController
  emittedSnapshots: DictationSnapshot[]
  insertionRequests: DictationInsertRequest[]
  requestCaptureStart: ReturnType<typeof vi.fn>
  requestCaptureStop: ReturnType<typeof vi.fn>
  setNow: (value: number) => void
} {
  let now = 1000
  const emittedSnapshots: DictationSnapshot[] = []
  const insertionRequests: DictationInsertRequest[] = []
  const requestCaptureStart = vi.fn()
  const requestCaptureStop = vi.fn()
  const controller = new DictationController({
    backend,
    emitSnapshot: (snapshot) => emittedSnapshots.push(snapshot),
    now: () => now,
    requestCaptureStart,
    requestCaptureStop,
    requestInsertion: (request) => insertionRequests.push(request),
    minRecordingMs: options.minRecordingMs ?? 0
  })

  return {
    controller,
    emittedSnapshots,
    insertionRequests,
    requestCaptureStart,
    requestCaptureStop,
    setNow: (value) => {
      now = value
    }
  }
}

describe('DictationController', () => {
  it('moves idle -> recording -> transcribing -> inserting -> idle', async () => {
    const { controller, emittedSnapshots, insertionRequests, setNow } = createController()

    controller.updateSettings({
      ...enabledSettings
    })
    await controller.startRecording()
    setNow(1800)
    await controller.stopRecording()
    await controller.completeRecording({ audioFilePath: '/tmp/pixel-dictation.wav' })

    expect(emittedSnapshots.map((snapshot) => snapshot.state)).toEqual([
      'idle',
      'recording',
      'transcribing',
      'inserting'
    ])
    expect(insertionRequests).toHaveLength(1)
    expect(insertionRequests[0].transcript).toMatchObject({
      durationMs: 800,
      text: 'hello pixel'
    } satisfies Partial<DictationTranscript>)
    expect(controller.getSnapshot().lastTranscriptId).toBe(insertionRequests[0].transcriptId)

    controller.reportInsertion({
      ok: true,
      target: 'pixel_text',
      transcriptId: insertionRequests[0].transcriptId
    })

    expect(controller.getSnapshot()).toMatchObject({
      lastInsertionTarget: 'pixel_text',
      state: 'idle'
    })
  })

  it('fails gracefully when backend is not ready', async () => {
    const { controller } = createController(
      createBackend({
        status: {
          available: true,
          id: 'macos-parakeet-coreml',
          label: 'Parakeet CoreML',
          message: 'Model not installed.',
          ready: false,
          status: 'not_installed'
        }
      })
    )

    controller.updateSettings({
      ...enabledSettings
    })
    await controller.startRecording()

    expect(controller.getSnapshot()).toMatchObject({
      error: 'Model not installed.',
      state: 'error'
    })
  })

  it('moves transcription backend failures into error state', async () => {
    const { controller } = createController(
      createBackend({
        transcribe: vi.fn().mockRejectedValue(new Error('Microphone permission denied.'))
      })
    )

    controller.updateSettings({
      ...enabledSettings
    })
    await controller.startRecording()
    await controller.stopRecording()
    await controller.completeRecording({ audioFilePath: '/tmp/pixel-dictation.wav' })

    expect(controller.getSnapshot()).toMatchObject({
      error: 'Microphone permission denied.',
      state: 'error'
    })
  })

  it('requests renderer microphone capture on start and stop', async () => {
    const { controller, requestCaptureStart, requestCaptureStop } = createController()

    controller.updateSettings({
      ...enabledSettings
    })
    await controller.startRecording()
    await controller.stopRecording()

    expect(requestCaptureStart).toHaveBeenCalledOnce()
    expect(requestCaptureStop).toHaveBeenCalledOnce()
  })

  it('waits for minimum audio before stopping a fresh recording', async () => {
    vi.useFakeTimers()
    const { controller, requestCaptureStop, setNow } = createController(createBackend(), {
      minRecordingMs: 900
    })

    controller.updateSettings({
      ...enabledSettings
    })
    await controller.startRecording()
    setNow(1200)
    await controller.stopRecording()

    expect(controller.getSnapshot().state).toBe('recording')
    expect(requestCaptureStop).not.toHaveBeenCalled()

    setNow(1900)
    await vi.advanceTimersByTimeAsync(700)

    expect(controller.getSnapshot().state).toBe('transcribing')
    expect(requestCaptureStop).toHaveBeenCalledOnce()
  })
})
