import type {
  DictationBackendId,
  DictationBackendStatus,
  DictationTranscript
} from '../../shared/dictation'

export type DictationBackend = {
  readonly id: DictationBackendId
  getStatus: () => DictationBackendStatus
  transcribe: (input: { startedAt: number; stoppedAt: number }) => Promise<DictationTranscript>
}

export function getBackendStatus(
  backendId: DictationBackendId,
  platform: NodeJS.Platform
): DictationBackendStatus {
  if (backendId === 'mock') {
    return {
      available: true,
      id: 'mock',
      label: 'Mock local backend',
      ready: true,
      status: 'ready'
    }
  }

  if (backendId === 'macos-parakeet-coreml') {
    if (platform !== 'darwin') {
      return {
        available: false,
        id: backendId,
        label: 'Parakeet CoreML',
        message: 'Parakeet CoreML is available only on macOS Apple Silicon.',
        ready: false,
        status: 'unsupported'
      }
    }

    return {
      available: true,
      id: backendId,
      label: 'Parakeet CoreML',
      message: 'Local model download is not implemented in this build yet.',
      ready: false,
      status: 'not_installed'
    }
  }

  if (platform === 'win32' || platform === 'linux') {
    return {
      available: true,
      id: backendId,
      label: 'ONNX sherpa',
      message: 'ONNX/sherpa backend is planned but not implemented yet.',
      ready: false,
      status: 'not_installed'
    }
  }

  return {
    available: false,
    id: backendId,
    label: 'ONNX sherpa',
    message: 'ONNX/sherpa backend is reserved for future Windows and Linux support.',
    ready: false,
    status: 'unsupported'
  }
}

export function selectPreferredDictationBackend(platform: NodeJS.Platform): DictationBackendId {
  if (platform === 'darwin') return 'macos-parakeet-coreml'
  if (platform === 'win32' || platform === 'linux') return 'onnx-sherpa'
  return 'mock'
}

export class MockDictationBackend implements DictationBackend {
  readonly id = 'mock' as const

  getStatus(): DictationBackendStatus {
    return getBackendStatus('mock', process.platform)
  }

  async transcribe({
    startedAt,
    stoppedAt
  }: {
    startedAt: number
    stoppedAt: number
  }): Promise<DictationTranscript> {
    const durationMs = Math.max(0, stoppedAt - startedAt)

    return {
      backend: this.id,
      durationMs,
      language: 'en',
      text: 'Local dictation test from Pixel.'
    }
  }
}
