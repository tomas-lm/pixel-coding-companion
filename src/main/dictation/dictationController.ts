import { randomUUID } from 'crypto'
import type {
  DictationInsertRequest,
  DictationInsertionResult,
  DictationSettings,
  DictationSnapshot,
  DictationState,
  DictationTranscript
} from '../../shared/dictation'
import type { DictationBackend } from './dictationBackends'

const DEFAULT_DICTATION_SETTINGS: DictationSettings = {
  enabled: false,
  keepLastAudioSample: false
}

type DictationControllerDependencies = {
  backend: DictationBackend
  emitSnapshot: (snapshot: DictationSnapshot) => void
  now?: () => number
  requestInsertion: (request: DictationInsertRequest) => void
}

export class DictationController {
  private readonly backend: DictationBackend
  private readonly emitSnapshot: (snapshot: DictationSnapshot) => void
  private readonly now: () => number
  private readonly requestInsertion: (request: DictationInsertRequest) => void
  private error: string | undefined
  private lastInsertionTarget: DictationSnapshot['lastInsertionTarget']
  private lastTranscript: DictationTranscript | undefined
  private recordingStartedAt = 0
  private settings = DEFAULT_DICTATION_SETTINGS
  private state: DictationState = 'idle'

  constructor({
    backend,
    emitSnapshot,
    now = () => Date.now(),
    requestInsertion
  }: DictationControllerDependencies) {
    this.backend = backend
    this.emitSnapshot = emitSnapshot
    this.now = now
    this.requestInsertion = requestInsertion
  }

  getSnapshot(): DictationSnapshot {
    return {
      backend: this.backend.getStatus(),
      error: this.error,
      lastInsertionTarget: this.lastInsertionTarget,
      lastTranscript: this.lastTranscript,
      settings: this.settings,
      shortcut: 'Control+Option',
      state: this.state
    }
  }

  reportInsertion(result: DictationInsertionResult): DictationSnapshot {
    if (!this.lastTranscript) return this.getSnapshot()

    if (!result.ok) {
      this.setState('error', result.reason ?? 'Could not insert the transcript.')
      return this.getSnapshot()
    }

    this.lastInsertionTarget = result.target
    this.setState('idle')
    return this.getSnapshot()
  }

  async startRecording(): Promise<DictationSnapshot> {
    if (!this.settings.enabled) {
      this.setState('error', 'Local transcriber is disabled.')
      return this.getSnapshot()
    }

    const backendStatus = this.backend.getStatus()
    if (!backendStatus.ready) {
      this.setState('error', backendStatus.message ?? 'Dictation backend is not ready.')
      return this.getSnapshot()
    }

    if (this.state !== 'idle' && this.state !== 'error') return this.getSnapshot()

    this.error = undefined
    this.recordingStartedAt = this.now()
    this.setState('recording')
    return this.getSnapshot()
  }

  async stopRecording(): Promise<DictationSnapshot> {
    if (this.state !== 'recording') return this.getSnapshot()

    const stoppedAt = this.now()
    this.setState('transcribing')

    try {
      const transcript = await this.backend.transcribe({
        startedAt: this.recordingStartedAt,
        stoppedAt
      })
      this.lastTranscript = transcript
      this.setState('inserting')
      this.requestInsertion({
        transcript,
        transcriptId: randomUUID()
      })
    } catch (error) {
      this.setState(
        'error',
        error instanceof Error ? error.message : 'Dictation backend failed during transcription.'
      )
    }

    return this.getSnapshot()
  }

  async testTranscription(): Promise<DictationSnapshot> {
    await this.startRecording()
    return this.stopRecording()
  }

  updateSettings(settings: DictationSettings): DictationSnapshot {
    this.settings = {
      enabled: settings.enabled,
      keepLastAudioSample: settings.keepLastAudioSample
    }
    if (!this.settings.enabled && this.state !== 'idle') {
      this.setState('idle')
    } else {
      this.emitSnapshot(this.getSnapshot())
    }

    return this.getSnapshot()
  }

  private setState(state: DictationState, error?: string): void {
    this.state = state
    this.error = error
    this.emitSnapshot(this.getSnapshot())
  }
}
