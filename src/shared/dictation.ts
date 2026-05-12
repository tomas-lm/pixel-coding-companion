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
  shortcutId: DictationShortcutId
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

export function isDictationShortcutId(value: unknown): value is DictationShortcutId {
  return DICTATION_SHORTCUT_OPTIONS.some((option) => option.id === value)
}

export function getDictationShortcutOption(id: DictationShortcutId): DictationShortcutOption {
  return (
    DICTATION_SHORTCUT_OPTIONS.find((option) => option.id === id) ?? DICTATION_SHORTCUT_OPTIONS[0]
  )
}
