import { shell, systemPreferences } from 'electron'
import type { DictationMicrophonePermissionSnapshot } from '../../shared/dictation'

type MacMediaAccessStatus = ReturnType<typeof systemPreferences.getMediaAccessStatus>

const MICROPHONE_SETTINGS_URL =
  'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone'

export function getMicrophonePermissionSnapshot(): DictationMicrophonePermissionSnapshot {
  if (process.platform !== 'darwin') {
    return {
      canPrompt: false,
      status: 'unsupported'
    }
  }

  return snapshotFromMacStatus(systemPreferences.getMediaAccessStatus('microphone'))
}

export async function requestMicrophonePermission(): Promise<DictationMicrophonePermissionSnapshot> {
  if (process.platform !== 'darwin') {
    return {
      canPrompt: false,
      status: 'unsupported'
    }
  }

  const currentStatus = systemPreferences.getMediaAccessStatus('microphone')
  if (currentStatus !== 'not-determined') {
    return snapshotFromMacStatus(currentStatus)
  }

  const granted = await systemPreferences.askForMediaAccess('microphone')
  return snapshotFromMacStatus(
    granted ? 'granted' : systemPreferences.getMediaAccessStatus('microphone')
  )
}

export function openMicrophonePrivacySettings(): void {
  if (process.platform !== 'darwin') return

  void shell.openExternal(MICROPHONE_SETTINGS_URL)
}

function snapshotFromMacStatus(
  status: MacMediaAccessStatus
): DictationMicrophonePermissionSnapshot {
  if (status === 'granted') {
    return {
      canPrompt: false,
      status
    }
  }

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

  return {
    canPrompt: false,
    message: 'Pixel could not read the current macOS microphone permission state.',
    status: 'unknown'
  }
}
