import type {
  DictationBackendId,
  DictationBackendStatus,
  DictationModelInstallSnapshot,
  DictationTranscript
} from '../../shared/dictation'
import type { NativeDictationRuntime } from './nativeDictationRuntime'
import type { SherpaOnnxRuntime } from './sherpaOnnxRuntime'

export type DictationBackend = {
  readonly id: DictationBackendId
  getStatus: () => DictationBackendStatus
  transcribe: (input: {
    audioFilePath?: string
    startedAt: number
    stoppedAt: number
  }) => Promise<DictationTranscript>
}

type ParakeetCoreMlBackendOptions = {
  getModelSnapshot: () => DictationModelInstallSnapshot
  hasRuntime?: () => boolean
  platform?: NodeJS.Platform
  runtime?: NativeDictationRuntime
}

type SherpaOnnxBackendOptions = {
  getModelSnapshot: () => DictationModelInstallSnapshot
  hasRuntime?: () => boolean
  platform?: NodeJS.Platform
  runtime?: SherpaOnnxRuntime
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

  if (backendId === 'onnx-sherpa') {
    if (platform !== 'linux') {
      return {
        available: false,
        id: backendId,
        label: 'Parakeet ONNX',
        message: 'Parakeet ONNX dictation is available only on Linux.',
        ready: false,
        status: 'unsupported'
      }
    }

    return {
      available: true,
      id: backendId,
      label: 'Parakeet ONNX',
      message: 'Download the Parakeet ONNX model from the Dictation tab.',
      ready: false,
      status: 'not_installed'
    }
  }

  return {
    available: false,
    id: backendId,
    label: 'Local dictation backend',
    message: 'This dictation backend is reserved for future platform support.',
    ready: false,
    status: 'unsupported'
  }
}

export function selectPreferredDictationBackend(platform: NodeJS.Platform): DictationBackendId {
  if (platform === 'darwin') return 'macos-parakeet-coreml'
  if (platform === 'linux') return 'onnx-sherpa'
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
  private readonly runtime: NativeDictationRuntime | undefined

  constructor({
    getModelSnapshot,
    hasRuntime,
    platform = process.platform,
    runtime
  }: ParakeetCoreMlBackendOptions) {
    this.getModelSnapshot = getModelSnapshot
    this.hasRuntime = hasRuntime ?? (() => Boolean(runtime?.isAvailable()))
    this.platform = platform
    this.runtime = runtime
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
          'Parakeet model is installed. Pixel still needs the native helper binary. Run npm run build:native:dictation.',
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

  async transcribe({
    audioFilePath,
    startedAt,
    stoppedAt
  }: {
    audioFilePath?: string
    startedAt: number
    stoppedAt: number
  }): Promise<DictationTranscript> {
    const model = this.getModelSnapshot()
    if (!audioFilePath) throw new Error('Pixel did not receive microphone audio to transcribe.')
    if (!this.runtime) throw new Error('Pixel dictation native runtime is not configured.')
    if (model.status !== 'installed' || !model.installPath) {
      throw new Error('Parakeet model is not installed.')
    }

    const result = await this.runtime.transcribe({
      audioFilePath,
      modelPath: model.installPath
    })

    return {
      backend: this.id,
      durationMs: result.durationMs ?? Math.max(0, stoppedAt - startedAt),
      language: result.language,
      text: result.text?.trim() ?? ''
    }
  }
}

export class SherpaOnnxBackend implements DictationBackend {
  readonly id = 'onnx-sherpa' as const
  private readonly getModelSnapshot: () => DictationModelInstallSnapshot
  private readonly hasRuntime: () => boolean
  private readonly platform: NodeJS.Platform
  private readonly runtime: SherpaOnnxRuntime | undefined

  constructor({
    getModelSnapshot,
    hasRuntime,
    platform = process.platform,
    runtime
  }: SherpaOnnxBackendOptions) {
    this.getModelSnapshot = getModelSnapshot
    this.hasRuntime = hasRuntime ?? (() => Boolean(runtime?.isAvailable()))
    this.platform = platform
    this.runtime = runtime
  }

  getStatus(): DictationBackendStatus {
    if (this.platform !== 'linux') {
      return getBackendStatus(this.id, this.platform)
    }

    const model = this.getModelSnapshot()
    if (model.status === 'checking' || model.status === 'downloading') {
      return {
        available: true,
        id: this.id,
        label: 'Parakeet ONNX',
        message: model.message,
        ready: false,
        status: 'installing'
      }
    }

    if (model.status === 'failed') {
      return {
        available: true,
        id: this.id,
        label: 'Parakeet ONNX',
        message: model.message ?? 'Parakeet ONNX model installation failed.',
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
        label: 'Parakeet ONNX',
        message: 'Parakeet ONNX model is installed. Pixel still needs the sherpa-onnx runtime.',
        ready: false,
        status: 'runtime_missing'
      }
    }

    return {
      available: true,
      id: this.id,
      label: 'Parakeet ONNX',
      ready: true,
      status: 'ready'
    }
  }

  async transcribe({
    audioFilePath,
    startedAt,
    stoppedAt
  }: {
    audioFilePath?: string
    startedAt: number
    stoppedAt: number
  }): Promise<DictationTranscript> {
    const model = this.getModelSnapshot()
    if (!audioFilePath) throw new Error('Pixel did not receive microphone audio to transcribe.')
    if (!this.runtime) throw new Error('Pixel dictation sherpa-onnx runtime is not configured.')
    if (model.status !== 'installed' || !model.installPath) {
      throw new Error('Parakeet ONNX model is not installed.')
    }

    const result = await this.runtime.transcribe({
      audioFilePath,
      modelPath: model.installPath
    })
    const text = result.text?.trim() ?? ''
    if (!text) throw new Error('Parakeet ONNX returned an empty transcript.')

    return {
      backend: this.id,
      durationMs: result.durationMs ?? Math.max(0, stoppedAt - startedAt),
      language: result.language,
      text
    }
  }
}
