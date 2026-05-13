export const DICTATION_CHANNELS = {
  clearHistory: 'dictation:clear-history',
  captureCommand: 'dictation:capture-command',
  completeCapture: 'dictation:complete-capture',
  completeInsertion: 'dictation:complete-insertion',
  deleteHistoryEntry: 'dictation:delete-history-entry',
  getMicrophonePermission: 'dictation:get-microphone-permission',
  installModel: 'dictation:install-model',
  insertExternalText: 'dictation:insert-external-text',
  listHistory: 'dictation:list-history',
  loadStats: 'dictation:load-stats',
  insertTranscript: 'dictation:insert-transcript',
  loadSnapshot: 'dictation:load-snapshot',
  finishOverlayDrag: 'dictation:finish-overlay-drag',
  moveOverlay: 'dictation:move-overlay',
  openAudioSettings: 'dictation:open-audio-settings',
  openMainWindow: 'dictation:open-main-window',
  openMicrophoneSettings: 'dictation:open-microphone-settings',
  requestMicrophonePermission: 'dictation:request-microphone-permission',
  setOverlayExpanded: 'dictation:set-overlay-expanded',
  state: 'dictation:state',
  testTranscription: 'dictation:test-transcription',
  toggleRecording: 'dictation:toggle-recording',
  updateSettings: 'dictation:update-settings'
} as const

export const PARAKEET_COREML_MODEL_URL =
  'https://huggingface.co/FluidInference/parakeet-tdt-0.6b-v3-coreml'

export const PARAKEET_COREML_MODEL_DOWNLOAD_SIZE_LABEL = '~461 MB'

export type DictationBackendId = 'macos-parakeet-coreml' | 'onnx-sherpa' | 'mock'

export type DictationState = 'idle' | 'recording' | 'transcribing' | 'inserting' | 'error'

export type DictationModifier = 'alt' | 'control' | 'meta' | 'shift'

export type DictationShortcutId = 'control-option-hold' | 'control-shift-hold' | 'option-shift-hold'

export type DictationShortcutOption = {
  id: DictationShortcutId
  label: string
  modifiers: DictationModifier[]
}

export const DICTATION_SHORTCUT_OPTIONS: DictationShortcutOption[] = [
  {
    id: 'control-option-hold',
    label: 'Control+Option',
    modifiers: ['control', 'alt']
  },
  {
    id: 'control-shift-hold',
    label: 'Control+Shift',
    modifiers: ['control', 'shift']
  },
  {
    id: 'option-shift-hold',
    label: 'Option+Shift',
    modifiers: ['alt', 'shift']
  }
]

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
      status: 'not_installed' | 'installing' | 'failed' | 'runtime_missing'
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
  keepAudioHistory: boolean
  keepLastAudioSample: boolean
  keepTranscriptHistory: boolean
  overlayEnabled: boolean
  shortcutId: DictationShortcutId
}

export type DictationMicrophonePermissionStatus =
  | 'denied'
  | 'granted'
  | 'not-determined'
  | 'restricted'
  | 'unknown'
  | 'unsupported'

export type DictationMicrophonePermissionSnapshot = {
  canPrompt: boolean
  message?: string
  status: DictationMicrophonePermissionStatus
}

export type DictationTranscript = {
  backend: DictationBackendId
  durationMs: number
  language?: string
  text: string
}

export type DictationHistoryEntry = {
  audioFilePath?: string
  backend: DictationBackendId
  characterCount: number
  createdAt: string
  durationMs: number
  estimatedKeystrokesAvoided: number
  id: string
  insertionTarget?: DictationInsertTarget
  language?: string
  text: string
  wordCount: number
}

export type DictationHistoryListRequest = {
  limit?: number
  query?: string
}

export type DictationHistoryListResult = {
  entries: DictationHistoryEntry[]
}

export type DictationHistoryDeleteRequest = {
  id: string
}

export type DictationStatsSnapshot = {
  audioStorageBytes: number
  averageWordsPerTranscript: number
  estimatedKeystrokesAvoided: number
  totalDurationMs: number
  totalTranscripts: number
  totalWordsDictated: number
  updatedAt: string
  wordsDictatedToday: number
}

export type DictationCaptureCommand = {
  type: 'start' | 'stop'
}

export type DictationCaptureResult =
  | {
      audioData: ArrayBuffer
      mimeType: 'audio/wav'
      ok: true
      sampleRate: number
    }
  | {
      ok: false
      reason: string
    }

export type DictationModelInstallStatus =
  | 'checking'
  | 'downloading'
  | 'failed'
  | 'installed'
  | 'not_installed'

export type DictationModelInstallSnapshot = {
  currentFile?: string
  downloadedBytes: number
  installPath?: string
  message?: string
  percent: number
  requiredBytesLabel: string
  sourceUrl: string
  status: DictationModelInstallStatus
  totalBytes: number
}

export type DictationInsertTarget = 'clipboard' | 'pixel_text' | 'system_text' | 'terminal'

export type DictationInsertRequest = {
  transcript: DictationTranscript
  transcriptId: string
}

export type DictationExternalInsertRequest = {
  text: string
}

export type DictationExternalInsertResult = {
  ok: boolean
  reason?: string
  target: Extract<DictationInsertTarget, 'clipboard' | 'system_text'>
}

export type DictationOverlayMoveRequest = {
  deltaX: number
  deltaY: number
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
  lastTranscriptId?: string
  model: DictationModelInstallSnapshot
  settings: DictationSettings
  shortcut: string
  state: DictationState
}

export type DictationApi = {
  clearHistory: () => Promise<DictationHistoryListResult>
  completeCapture: (result: DictationCaptureResult) => Promise<DictationSnapshot>
  completeInsertion: (result: DictationInsertionResult) => void
  deleteHistoryEntry: (
    request: DictationHistoryDeleteRequest
  ) => Promise<DictationHistoryListResult>
  getMicrophonePermission: () => Promise<DictationMicrophonePermissionSnapshot>
  installModel: () => Promise<DictationSnapshot>
  insertExternalText: (
    request: DictationExternalInsertRequest
  ) => Promise<DictationExternalInsertResult>
  listHistory: (request?: DictationHistoryListRequest) => Promise<DictationHistoryListResult>
  loadStats: () => Promise<DictationStatsSnapshot>
  loadSnapshot: () => Promise<DictationSnapshot>
  finishOverlayDrag: () => void
  moveOverlay: (request: DictationOverlayMoveRequest) => void
  onCaptureCommand: (callback: (command: DictationCaptureCommand) => void) => () => void
  onInsertTranscript: (callback: (request: DictationInsertRequest) => void) => () => void
  onOpenAudioSettings: (callback: () => void) => () => void
  onState: (callback: (snapshot: DictationSnapshot) => void) => () => void
  openAudioSettings: () => void
  openMainWindow: () => void
  openMicrophoneSettings: () => void
  requestMicrophonePermission: () => Promise<DictationMicrophonePermissionSnapshot>
  setOverlayExpanded: (expanded: boolean) => void
  testTranscription: () => Promise<DictationSnapshot>
  toggleRecording: () => Promise<DictationSnapshot>
  updateSettings: (settings: DictationSettings) => Promise<DictationSnapshot>
}

export function isDictationShortcutId(value: unknown): value is DictationShortcutId {
  return DICTATION_SHORTCUT_OPTIONS.some((option) => option.id === value)
}

export function getDictationShortcutOption(id: DictationShortcutId): DictationShortcutOption {
  return (
    DICTATION_SHORTCUT_OPTIONS.find((option) => option.id === id) ?? DICTATION_SHORTCUT_OPTIONS[0]
  )
}
