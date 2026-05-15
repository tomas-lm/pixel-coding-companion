import { createRequire } from 'module'
import { join } from 'path'

const require = createRequire(import.meta.url)

type SherpaOnnxWave = {
  sampleRate: number
  samples: Float32Array
}

type SherpaOnnxResult = {
  lang?: string
  text?: string
}

type SherpaOnnxNodeStream = {
  acceptWaveform: (input: SherpaOnnxWave) => void
}

type SherpaOnnxNodeRecognizer = {
  createStream: () => SherpaOnnxNodeStream
  decode: (stream: SherpaOnnxNodeStream) => void
  getResult: (stream: SherpaOnnxNodeStream) => SherpaOnnxResult
}

type SherpaOnnxNodeModule = {
  OfflineRecognizer: new (config: SherpaOnnxRecognizerConfig) => SherpaOnnxNodeRecognizer
  readWave: (filename: string, enableExternalBuffer?: boolean) => SherpaOnnxWave
}

type SherpaOnnxWasmStream = {
  acceptWaveform: (sampleRate: number, samples: Float32Array) => void
  free: () => void
}

type SherpaOnnxWasmRecognizer = {
  createStream: () => SherpaOnnxWasmStream
  decode: (stream: SherpaOnnxWasmStream) => void
  free: () => void
  getResult: (stream: SherpaOnnxWasmStream) => SherpaOnnxResult
}

type SherpaOnnxWasmModule = {
  createOfflineRecognizer: (config: SherpaOnnxRecognizerConfig) => SherpaOnnxWasmRecognizer
  readWave: (filename: string) => SherpaOnnxWave
}

type SherpaOnnxRecognizerConfig = {
  decodingMethod: 'greedy_search'
  featConfig: {
    featureDim: number
    sampleRate: number
  }
  maxActivePaths: number
  modelConfig: {
    debug: number
    modelType: 'nemo_transducer'
    numThreads: number
    provider: 'cpu'
    tokens: string
    transducer: {
      decoder: string
      encoder: string
      joiner: string
    }
  }
}

export type SherpaOnnxTranscriptionInput = {
  audioFilePath: string
  modelPath: string
}

export type SherpaOnnxTranscriptionResult = {
  durationMs?: number
  language?: string
  text?: string
}

export class SherpaOnnxRuntime {
  private nativeRecognizer: SherpaOnnxNodeRecognizer | null = null
  private wasmRecognizer: SherpaOnnxWasmRecognizer | null = null
  private recognizerModelPath: string | null = null
  private nodeModule: SherpaOnnxNodeModule | null = null
  private wasmModule: SherpaOnnxWasmModule | null = null

  isAvailable(): boolean {
    return this.canResolve('sherpa-onnx-node') || this.canResolve('sherpa-onnx')
  }

  async transcribe({
    audioFilePath,
    modelPath
  }: SherpaOnnxTranscriptionInput): Promise<SherpaOnnxTranscriptionResult> {
    const startedAt = Date.now()
    const config = createRecognizerConfig(modelPath)
    const { nativeFailure, nodeModule, wasmFailure, wasmModule } = this.loadRuntimeModules()

    if (nodeModule) {
      const recognizer = this.getNodeRecognizer(modelPath, config, nodeModule)
      const wave = normalizeWaveSamples(nodeModule.readWave(audioFilePath, false))
      const stream = recognizer.createStream()
      stream.acceptWaveform(wave)

      const result = recognizer.decode(stream) ?? recognizer.getResult(stream)
      return normalizeResult(result, startedAt)
    }

    if (!wasmModule) {
      throw createRuntimeLoadError(nativeFailure, wasmFailure)
    }

    const recognizer = this.getWasmRecognizer(modelPath, config, wasmModule)
    const wave = normalizeWaveSamples(wasmModule.readWave(audioFilePath))
    const stream = recognizer.createStream()

    try {
      stream.acceptWaveform(wave.sampleRate, wave.samples)
      recognizer.decode(stream)

      return normalizeResult(recognizer.getResult(stream), startedAt)
    } finally {
      stream.free()
    }
  }

  private canResolve(moduleName: string): boolean {
    try {
      require.resolve(moduleName)
      return true
    } catch {
      return false
    }
  }

  private loadRuntimeModules(): {
    nativeFailure: Error | null
    nodeModule: SherpaOnnxNodeModule | null
    wasmFailure: Error | null
    wasmModule: SherpaOnnxWasmModule | null
  } {
    const nativeLoad = this.tryLoadNodeModule()
    if (nativeLoad.module) {
      return {
        nativeFailure: null,
        nodeModule: nativeLoad.module,
        wasmFailure: null,
        wasmModule: null
      }
    }

    if (nativeLoad.error) {
      console.warn(
        `Sherpa native runtime failed to load, attempting WASM fallback: ${nativeLoad.error.message}`
      )
    }

    const wasmLoad = this.tryLoadWasmModule()

    return {
      nativeFailure: nativeLoad.error,
      nodeModule: null,
      wasmFailure: wasmLoad.error,
      wasmModule: wasmLoad.module
    }
  }

  private getNodeRecognizer(
    modelPath: string,
    config: SherpaOnnxRecognizerConfig,
    sherpaOnnx: SherpaOnnxNodeModule
  ): SherpaOnnxNodeRecognizer {
    if (this.nativeRecognizer && this.recognizerModelPath === modelPath)
      return this.nativeRecognizer

    this.nativeRecognizer = new sherpaOnnx.OfflineRecognizer(config)
    this.wasmRecognizer?.free()
    this.wasmRecognizer = null
    this.recognizerModelPath = modelPath
    return this.nativeRecognizer
  }

  private getWasmRecognizer(
    modelPath: string,
    config: SherpaOnnxRecognizerConfig,
    sherpaOnnx: SherpaOnnxWasmModule
  ): SherpaOnnxWasmRecognizer {
    if (this.wasmRecognizer && this.recognizerModelPath === modelPath) return this.wasmRecognizer

    this.wasmRecognizer?.free()
    this.wasmRecognizer = sherpaOnnx.createOfflineRecognizer(config)
    this.nativeRecognizer = null
    this.recognizerModelPath = modelPath
    return this.wasmRecognizer
  }

  private tryLoadNodeModule(): {
    error: Error | null
    module: SherpaOnnxNodeModule | null
  } {
    if (this.nodeModule) {
      return {
        error: null,
        module: this.nodeModule
      }
    }
    if (!this.canResolve('sherpa-onnx-node')) return { error: null, module: null }

    try {
      this.nodeModule = require('sherpa-onnx-node') as SherpaOnnxNodeModule
      return {
        error: null,
        module: this.nodeModule
      }
    } catch (error) {
      return {
        error:
          error instanceof Error
            ? new Error(`Could not load sherpa-onnx-node runtime: ${error.message}`)
            : new Error('Could not load sherpa-onnx-node runtime.'),
        module: null
      }
    }
  }

  private tryLoadWasmModule(): {
    error: Error | null
    module: SherpaOnnxWasmModule | null
  } {
    if (this.wasmModule) {
      return {
        error: null,
        module: this.wasmModule
      }
    }
    if (!this.canResolve('sherpa-onnx')) return { error: null, module: null }

    try {
      this.wasmModule = require('sherpa-onnx') as SherpaOnnxWasmModule
      return {
        error: null,
        module: this.wasmModule
      }
    } catch (error) {
      return {
        error:
          error instanceof Error
            ? new Error(`Could not load sherpa-onnx runtime: ${error.message}`)
            : new Error('Could not load sherpa-onnx runtime.'),
        module: null
      }
    }
  }
}

function createRuntimeLoadError(nativeFailure: Error | null, wasmFailure: Error | null): Error {
  const nativeMessage =
    nativeFailure?.message ??
    'Could not load sherpa-onnx-node runtime: module could not be resolved.'
  const wasmMessage =
    wasmFailure?.message ?? 'Could not load sherpa-onnx runtime: module could not be resolved.'

  return new Error(`No Sherpa runtime could be loaded. ${nativeMessage} ${wasmMessage}`)
}

function createRecognizerConfig(modelPath: string): SherpaOnnxRecognizerConfig {
  return {
    decodingMethod: 'greedy_search',
    featConfig: {
      featureDim: 80,
      sampleRate: 16000
    },
    maxActivePaths: 4,
    modelConfig: {
      debug: 0,
      modelType: 'nemo_transducer',
      numThreads: 1,
      provider: 'cpu',
      tokens: join(modelPath, 'tokens.txt'),
      transducer: {
        decoder: join(modelPath, 'decoder.int8.onnx'),
        encoder: join(modelPath, 'encoder.int8.onnx'),
        joiner: join(modelPath, 'joiner.int8.onnx')
      }
    }
  }
}

function normalizeResult(
  result: SherpaOnnxResult | undefined,
  startedAt: number
): SherpaOnnxTranscriptionResult {
  const text = result?.text?.trim() ?? ''
  if (!text) throw new Error('Parakeet ONNX returned an empty transcript.')

  return {
    durationMs: Date.now() - startedAt,
    language: result?.lang,
    text
  }
}

function normalizeWaveSamples(wave: SherpaOnnxWave): SherpaOnnxWave {
  return {
    sampleRate: wave.sampleRate,
    samples: new Float32Array(wave.samples)
  }
}
