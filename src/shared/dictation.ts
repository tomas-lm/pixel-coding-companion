export const DICTATION_CHANNELS = {
  completeInsertion: 'dictation:complete-insertion',
  insertTranscript: 'dictation:insert-transcript',
  loadSnapshot: 'dictation:load-snapshot',
  state: 'dictation:state',
  testTranscription: 'dictation:test-transcription',
  updateSettings: 'dictation:update-settings'
} as const

export type DictationBackendId = 'macos-parakeet-coreml' | 'onnx-sherpa' | 'mock'

export type DictationState = 'idle' | 'recording' | 'transcribing' | 'inserting' | 'error'

export type DictationBackendStatus =
  | {
      available: true
      id: DictationBackendId
      label: string
      ready: true
      status: 'ready'
    }
  | {
      available: true
      id: DictationBackendId
      label: string
      ready: false
      status: 'not_installed' | 'installing' | 'failed'
      message?: string
    }
  | {
      available: false
      id: DictationBackendId
      label: string
      ready: false
      status: 'unsupported'
      message: string
    }

export type DictationSettings = {
  enabled: boolean
  keepLastAudioSample: boolean
}

export type DictationTranscript = {
  backend: DictationBackendId
  durationMs: number
  language?: string
  text: string
}

export type DictationInsertTarget = 'clipboard' | 'pixel_text' | 'terminal'

export type DictationInsertRequest = {
  transcript: DictationTranscript
  transcriptId: string
}

export type DictationInsertionResult = {
  ok: boolean
  reason?: string
  target: DictationInsertTarget
  transcriptId: string
}

export type DictationSnapshot = {
  backend: DictationBackendStatus
  error?: string
  lastInsertionTarget?: DictationInsertTarget
  lastTranscript?: DictationTranscript
  settings: DictationSettings
  shortcut: string
  state: DictationState
}

export type DictationApi = {
  completeInsertion: (result: DictationInsertionResult) => void
  loadSnapshot: () => Promise<DictationSnapshot>
  onInsertTranscript: (callback: (request: DictationInsertRequest) => void) => () => void
  onState: (callback: (snapshot: DictationSnapshot) => void) => () => void
  testTranscription: () => Promise<DictationSnapshot>
  updateSettings: (settings: DictationSettings) => Promise<DictationSnapshot>
}
