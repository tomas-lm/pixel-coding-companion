import type {
  DictationBackendId,
  DictationBackendStatus,
  DictationModelInstallSnapshot,
  DictationTranscript
} from '../../shared/dictation'

export type DictationBackend = {
  readonly id: DictationBackendId
  getStatus: () => DictationBackendStatus
  transcribe: (input: { startedAt: number; stoppedAt: number }) => Promise<DictationTranscript>
}

type ParakeetCoreMlBackendOptions = {
  getModelSnapshot: () => DictationModelInstallSnapshot
  hasRuntime?: () => boolean
  platform?: NodeJS.Platform
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
      message: 'Download the Parakeet Core ML model from the Dictation tab.',
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

export class ParakeetCoreMlBackend implements DictationBackend {
  readonly id = 'macos-parakeet-coreml' as const
  private readonly getModelSnapshot: () => DictationModelInstallSnapshot
  private readonly hasRuntime: () => boolean
  private readonly platform: NodeJS.Platform

  constructor({
    getModelSnapshot,
    hasRuntime = () => false,
    platform = process.platform
  }: ParakeetCoreMlBackendOptions) {
    this.getModelSnapshot = getModelSnapshot
    this.hasRuntime = hasRuntime
    this.platform = platform
  }

  getStatus(): DictationBackendStatus {
    if (this.platform !== 'darwin') {
      return getBackendStatus(this.id, this.platform)
    }

    const model = this.getModelSnapshot()
    if (model.status === 'checking' || model.status === 'downloading') {
      return {
        available: true,
        id: this.id,
        label: 'Parakeet CoreML',
        message: model.message,
        ready: false,
        status: 'installing'
      }
    }

    if (model.status === 'failed') {
      return {
        available: true,
        id: this.id,
        label: 'Parakeet CoreML',
        message: model.message ?? 'Parakeet model installation failed.',
        ready: false,
        status: 'failed'
      }
    }

    if (model.status !== 'installed') {
      return getBackendStatus(this.id, this.platform)
    }

    if (!this.hasRuntime()) {
      return {
        available: true,
        id: this.id,
        label: 'Parakeet CoreML',
        message:
          'Parakeet model is installed. Pixel still needs the native Core ML runtime before it can transcribe real audio.',
        ready: false,
        status: 'runtime_missing'
      }
    }

    return {
      available: true,
      id: this.id,
      label: 'Parakeet CoreML',
      ready: true,
      status: 'ready'
    }
  }

  async transcribe(): Promise<DictationTranscript> {
    throw new Error(
      'Real Parakeet transcription is not available until the native Core ML runtime is bundled.'
    )
  }
}
