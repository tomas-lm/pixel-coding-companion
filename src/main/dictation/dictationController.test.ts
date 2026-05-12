import { describe, expect, it, vi } from 'vitest'
import type {
  DictationBackendStatus,
  DictationInsertRequest,
  DictationSnapshot,
  DictationTranscript
} from '../../shared/dictation'
import { DictationController } from './dictationController'
import type { DictationBackend } from './dictationBackends'

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

function createController(backend = createBackend()): {
  controller: DictationController
  emittedSnapshots: DictationSnapshot[]
  insertionRequests: DictationInsertRequest[]
  setNow: (value: number) => void
} {
  let now = 1000
  const emittedSnapshots: DictationSnapshot[] = []
  const insertionRequests: DictationInsertRequest[] = []
  const controller = new DictationController({
    backend,
    emitSnapshot: (snapshot) => emittedSnapshots.push(snapshot),
    now: () => now,
    requestInsertion: (request) => insertionRequests.push(request)
  })

  return {
    controller,
    emittedSnapshots,
    insertionRequests,
    setNow: (value) => {
      now = value
    }
  }
}

describe('DictationController', () => {
  it('moves idle -> recording -> transcribing -> inserting -> idle', async () => {
    const { controller, emittedSnapshots, insertionRequests, setNow } = createController()

    controller.updateSettings({ enabled: true, keepLastAudioSample: false })
    await controller.startRecording()
    setNow(1800)
    await controller.stopRecording()

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

    controller.updateSettings({ enabled: true, keepLastAudioSample: false })
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

    controller.updateSettings({ enabled: true, keepLastAudioSample: false })
    await controller.startRecording()
    await controller.stopRecording()

    expect(controller.getSnapshot()).toMatchObject({
      error: 'Microphone permission denied.',
      state: 'error'
    })
  })
})
