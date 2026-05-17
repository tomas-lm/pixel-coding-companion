import { afterEach, describe, expect, it, vi } from 'vitest'

describe('SherpaOnnxRuntime', () => {
  afterEach(() => {
    vi.doUnmock('module')
    vi.resetModules()
    vi.restoreAllMocks()
  })

  it('loads native wave samples without external buffers and copies them before transcription', async () => {
    const returnedSamples = new Float32Array([0.25, -0.5, 0.75])
    const acceptWaveform = vi.fn()
    const stream = { acceptWaveform }
    const recognizer = {
      createStream: vi.fn(() => stream),
      decode: vi.fn(),
      getResult: vi.fn(() => ({ text: 'hello linux' }))
    }
    const readWave = vi.fn(() => ({
      sampleRate: 16000,
      samples: returnedSamples
    }))
    const OfflineRecognizer = vi.fn(function OfflineRecognizer() {
      return recognizer
    })
    const requireMock = vi.fn((moduleName: string) => {
      if (moduleName === 'sherpa-onnx-node') return { OfflineRecognizer, readWave }
      throw new Error(`Unexpected module: ${moduleName}`)
    }) as unknown as NodeJS.Require

    requireMock.resolve = vi.fn((moduleName: string) => {
      if (moduleName === 'sherpa-onnx-node') return '/mock/sherpa-onnx-node.js'
      throw new Error(`Cannot resolve module: ${moduleName}`)
    }) as unknown as NodeJS.RequireResolve

    vi.doMock('module', () => {
      const moduleMock = {
        createRequire: () => requireMock
      }
      return {
        ...moduleMock,
        default: moduleMock
      }
    })

    const { SherpaOnnxRuntime } = await import('./sherpaOnnxRuntime')
    const runtime = new SherpaOnnxRuntime()

    await expect(
      runtime.transcribe({
        audioFilePath: '/tmp/pixel-dictation.wav',
        modelPath: '/tmp/pixel-model'
      })
    ).resolves.toMatchObject({ text: 'hello linux' })

    expect(readWave).toHaveBeenCalledWith('/tmp/pixel-dictation.wav', false)
    expect(acceptWaveform).toHaveBeenCalledTimes(1)

    const acceptedWave = acceptWaveform.mock.calls[0]?.[0]
    expect(acceptedWave).toMatchObject({ sampleRate: 16000 })
    expect(acceptedWave.samples).toBeInstanceOf(Float32Array)
    expect(acceptedWave.samples).not.toBe(returnedSamples)
    expect(Array.from(acceptedWave.samples)).toEqual(Array.from(returnedSamples))
  })

  it('falls back to the WASM runtime when native loading fails', async () => {
    const nativeError = new Error('invalid ELF header')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const returnedSamples = new Float32Array([0.1, 0.2])
    const stream = {
      acceptWaveform: vi.fn(),
      free: vi.fn()
    }
    const recognizer = {
      createStream: vi.fn(() => stream),
      decode: vi.fn(),
      free: vi.fn(),
      getResult: vi.fn(() => ({ lang: 'en', text: 'wasm transcript' }))
    }
    const wasmModule = {
      createOfflineRecognizer: vi.fn(() => recognizer),
      readWave: vi.fn(() => ({
        sampleRate: 16000,
        samples: returnedSamples
      }))
    }
    const requireMock = vi.fn((moduleName: string) => {
      if (moduleName === 'sherpa-onnx-node') throw nativeError
      if (moduleName === 'sherpa-onnx') return wasmModule
      throw new Error(`Unexpected module: ${moduleName}`)
    }) as unknown as NodeJS.Require

    requireMock.resolve = vi.fn((moduleName: string) => {
      if (moduleName === 'sherpa-onnx-node') return '/mock/sherpa-onnx-node.js'
      if (moduleName === 'sherpa-onnx') return '/mock/sherpa-onnx.js'
      throw new Error(`Cannot resolve module: ${moduleName}`)
    }) as unknown as NodeJS.RequireResolve

    vi.doMock('module', () => {
      const moduleMock = {
        createRequire: () => requireMock
      }
      return {
        ...moduleMock,
        default: moduleMock
      }
    })

    const { SherpaOnnxRuntime } = await import('./sherpaOnnxRuntime')
    const runtime = new SherpaOnnxRuntime()

    await expect(
      runtime.transcribe({
        audioFilePath: '/tmp/pixel-dictation.wav',
        modelPath: '/tmp/pixel-model'
      })
    ).resolves.toMatchObject({ language: 'en', text: 'wasm transcript' })

    expect(warn).toHaveBeenCalledWith(
      'Sherpa native runtime failed to load, attempting WASM fallback: Could not load sherpa-onnx-node runtime: invalid ELF header'
    )
    expect(wasmModule.readWave).toHaveBeenCalledWith('/tmp/pixel-dictation.wav')
    expect(stream.acceptWaveform).toHaveBeenCalledWith(16000, expect.any(Float32Array))
    expect(stream.free).toHaveBeenCalledOnce()
  })

  it('includes native and WASM failure context when no runtime can load', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const requireMock = vi.fn((moduleName: string) => {
      if (moduleName === 'sherpa-onnx-node') {
        throw new Error('native symbol lookup failed')
      }
      if (moduleName === 'sherpa-onnx') {
        throw new Error('wasm bindings missing')
      }
      throw new Error(`Unexpected module: ${moduleName}`)
    }) as unknown as NodeJS.Require

    requireMock.resolve = vi.fn((moduleName: string) => {
      if (moduleName === 'sherpa-onnx-node') return '/mock/sherpa-onnx-node.js'
      if (moduleName === 'sherpa-onnx') return '/mock/sherpa-onnx.js'
      throw new Error(`Cannot resolve module: ${moduleName}`)
    }) as unknown as NodeJS.RequireResolve

    vi.doMock('module', () => {
      const moduleMock = {
        createRequire: () => requireMock
      }
      return {
        ...moduleMock,
        default: moduleMock
      }
    })

    const { SherpaOnnxRuntime } = await import('./sherpaOnnxRuntime')
    const runtime = new SherpaOnnxRuntime()

    await expect(
      runtime.transcribe({
        audioFilePath: '/tmp/pixel-dictation.wav',
        modelPath: '/tmp/pixel-model'
      })
    ).rejects.toThrow(
      'No Sherpa runtime could be loaded. Could not load sherpa-onnx-node runtime: native symbol lookup failed Could not load sherpa-onnx runtime: wasm bindings missing'
    )

    expect(warn).toHaveBeenCalledWith(
      'Sherpa native runtime failed to load, attempting WASM fallback: Could not load sherpa-onnx-node runtime: native symbol lookup failed'
    )
  })
})
