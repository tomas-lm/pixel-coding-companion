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
})
