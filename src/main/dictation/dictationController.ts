import { randomUUID } from 'crypto'
import type {
  DictationModelInstallSnapshot,
  DictationShortcutId,
  DictationInsertRequest,
  DictationInsertionResult,
  DictationSettings,
  DictationSnapshot,
  DictationState,
  DictationTranscript
} from '../../shared/dictation'
import {
  PARAKEET_COREML_MODEL_DOWNLOAD_SIZE_LABEL,
  PARAKEET_COREML_MODEL_URL,
  getDictationShortcutOption
} from '../../shared/dictation'
import type { DictationBackend } from './dictationBackends'

const DEFAULT_DICTATION_SETTINGS: DictationSettings = {
  enabled: false,
  keepLastAudioSample: false,
  shortcutId: 'control-option-hold'
}

const DEFAULT_MODEL_INSTALL_SNAPSHOT: DictationModelInstallSnapshot = {
  downloadedBytes: 0,
  percent: 0,
  requiredBytesLabel: PARAKEET_COREML_MODEL_DOWNLOAD_SIZE_LABEL,
  sourceUrl: PARAKEET_COREML_MODEL_URL,
  status: 'not_installed',
  totalBytes: 0
}

type DictationControllerDependencies = {
  backend: DictationBackend
  emitSnapshot: (snapshot: DictationSnapshot) => void
  getModelSnapshot?: () => DictationModelInstallSnapshot
  now?: () => number
  requestCaptureStart?: () => void
  requestCaptureStop?: () => void
  requestInsertion: (request: DictationInsertRequest) => void
  testRecordingMs?: number
}

type DictationRecordingInput = {
  audioFilePath: string
}

export class DictationController {
  private readonly backend: DictationBackend
  private readonly emitSnapshot: (snapshot: DictationSnapshot) => void
  private readonly getModelSnapshot: () => DictationModelInstallSnapshot
  private readonly now: () => number
  private readonly requestCaptureStart: () => void
  private readonly requestCaptureStop: () => void
  private readonly requestInsertion: (request: DictationInsertRequest) => void
  private readonly testRecordingMs: number
  private error: string | undefined
  private lastInsertionTarget: DictationSnapshot['lastInsertionTarget']
  private lastTranscript: DictationTranscript | undefined
  private recordingStartedAt = 0
  private settings = DEFAULT_DICTATION_SETTINGS
  private state: DictationState = 'idle'
  private testRecordingTimer: NodeJS.Timeout | null = null

  constructor({
    backend,
    emitSnapshot,
    getModelSnapshot = () => DEFAULT_MODEL_INSTALL_SNAPSHOT,
    now = () => Date.now(),
    requestCaptureStart = () => {},
    requestCaptureStop = () => {},
    requestInsertion,
    testRecordingMs = 3000
  }: DictationControllerDependencies) {
    this.backend = backend
    this.emitSnapshot = emitSnapshot
    this.getModelSnapshot = getModelSnapshot
    this.now = now
    this.requestCaptureStart = requestCaptureStart
    this.requestCaptureStop = requestCaptureStop
    this.requestInsertion = requestInsertion
    this.testRecordingMs = testRecordingMs
  }

  getSnapshot(): DictationSnapshot {
    return {
      backend: this.backend.getStatus(),
      error: this.error,
      lastInsertionTarget: this.lastInsertionTarget,
      lastTranscript: this.lastTranscript,
      model: this.getModelSnapshot(),
      settings: this.settings,
      shortcut: getDictationShortcutOption(this.settings.shortcutId).label,
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
    this.requestCaptureStart()
    return this.getSnapshot()
  }

  async stopRecording(): Promise<DictationSnapshot> {
    if (this.state !== 'recording') return this.getSnapshot()

    this.clearTestRecordingTimer()
    this.setState('transcribing')
    this.requestCaptureStop()
    return this.getSnapshot()
  }

  async completeRecording({ audioFilePath }: DictationRecordingInput): Promise<DictationSnapshot> {
    if (this.state !== 'transcribing') return this.getSnapshot()

    const stoppedAt = this.now()

    try {
      const transcript = await this.backend.transcribe({
        audioFilePath,
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
    const snapshot = await this.startRecording()
    if (snapshot.state === 'recording') {
      this.clearTestRecordingTimer()
      this.testRecordingTimer = setTimeout(() => {
        this.testRecordingTimer = null
        void this.stopRecording()
      }, this.testRecordingMs)
    }

    return snapshot
  }

  failRecording(reason: string): DictationSnapshot {
    this.clearTestRecordingTimer()
    this.setState('error', reason)
    return this.getSnapshot()
  }

  updateSettings(settings: DictationSettings): DictationSnapshot {
    this.settings = {
      enabled: settings.enabled,
      keepLastAudioSample: settings.keepLastAudioSample,
      shortcutId: settings.shortcutId
    }
    if (!this.settings.enabled && this.state !== 'idle') {
      this.clearTestRecordingTimer()
      this.setState('idle')
    } else {
      this.emitSnapshot(this.getSnapshot())
    }

    return this.getSnapshot()
  }

  getShortcutId(): DictationShortcutId {
    return this.settings.shortcutId
  }

  private setState(state: DictationState, error?: string): void {
    this.state = state
    this.error = error
    this.emitSnapshot(this.getSnapshot())
  }

  private clearTestRecordingTimer(): void {
    if (!this.testRecordingTimer) return

    clearTimeout(this.testRecordingTimer)
    this.testRecordingTimer = null
  }
}
