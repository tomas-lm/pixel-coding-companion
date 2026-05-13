import type {
  DictationMicrophonePermissionSnapshot,
  DictationMicrophonePermissionStatus
} from '../../../shared/dictation'

export function createGrantedDictationMicrophonePermission(): DictationMicrophonePermissionSnapshot {
  return {
    canPrompt: false,
    status: 'granted'
  }
}

export function createUnknownDictationMicrophonePermission(
  message = 'Pixel could not verify microphone permission.'
): DictationMicrophonePermissionSnapshot {
  return {
    canPrompt: false,
    message,
    status: 'unknown'
  }
}

export function snapshotFromBrowserMicrophonePermissionStatus(
  status: DictationMicrophonePermissionStatus
): DictationMicrophonePermissionSnapshot | null {
  if (status === 'granted') return createGrantedDictationMicrophonePermission()

  if (status === 'not-determined') {
    return {
      canPrompt: true,
      message: 'Pixel needs microphone permission before local dictation can capture audio.',
      status
    }
  }

  if (status === 'denied' || status === 'restricted') {
    return {
      canPrompt: false,
      message: 'Microphone access is blocked in macOS Privacy settings.',
      status
    }
  }

  if (status === 'unsupported') {
    return {
      canPrompt: false,
      status
    }
  }

  return null
}

export function mergeMicrophonePermissionSnapshots(
  nativePermission: DictationMicrophonePermissionSnapshot,
  browserStatus: DictationMicrophonePermissionStatus
): DictationMicrophonePermissionSnapshot {
  const browserPermission = snapshotFromBrowserMicrophonePermissionStatus(browserStatus)
  if (!browserPermission) return nativePermission

  if (browserPermission.status === 'granted') return browserPermission
  if (nativePermission.status === 'granted') return nativePermission
  if (nativePermission.status === 'unknown') return browserPermission

  return nativePermission
}

export function withMicrophoneCaptureError(
  permission: DictationMicrophonePermissionSnapshot,
  error: unknown
): DictationMicrophonePermissionSnapshot {
  if (!(error instanceof Error)) return permission

  return {
    ...permission,
    message: error.message
  }
}
