import { describe, expect, it } from 'vitest'
import type { DictationModelInstallSnapshot } from '../../shared/dictation'
import {
  ParakeetCoreMlBackend,
  SherpaOnnxBackend,
  getBackendStatus,
  selectPreferredDictationBackend
} from './dictationBackends'
import type { SherpaOnnxRuntime } from './sherpaOnnxRuntime'

describe('dictationBackends', () => {
  it('selects Parakeet CoreML as the preferred macOS backend', () => {
    expect(selectPreferredDictationBackend('darwin')).toBe('macos-parakeet-coreml')
  })

  it('selects ONNX sherpa for Linux support', () => {
    expect(selectPreferredDictationBackend('linux')).toBe('onnx-sherpa')
  })

  it('keeps the mock backend as the preferred fallback on other platforms', () => {
    expect(selectPreferredDictationBackend('win32')).toBe('mock')
  })

  it('exposes unsupported backend status without crashing', () => {
    expect(getBackendStatus('macos-parakeet-coreml', 'linux')).toMatchObject({
      available: false,
      ready: false,
      status: 'unsupported'
    })
  })

  it('keeps the mock backend ready for scaffolded local dictation', () => {
    expect(getBackendStatus('mock', 'darwin')).toMatchObject({
      available: true,
      ready: true,
      status: 'ready'
    })
  })

  it('does not report Parakeet ready when only the model is installed', () => {
    const backend = new ParakeetCoreMlBackend({
      getModelSnapshot: () => ({
        downloadedBytes: 483_103_089,
        installPath: '/tmp/pixel/parakeet',
        percent: 100,
        requiredBytesLabel: '~461 MB',
        sourceUrl: 'https://huggingface.co/FluidInference/parakeet-tdt-0.6b-v3-coreml',
        status: 'installed',
        totalBytes: 483_103_089
      }),
      platform: 'darwin'
    })

    expect(backend.getStatus()).toMatchObject({
      ready: false,
      status: 'runtime_missing'
    })
  })

  it('reports Parakeet ready when the model and native runtime are available', () => {
    const backend = new ParakeetCoreMlBackend({
      getModelSnapshot: () => ({
        downloadedBytes: 483_103_089,
        installPath: '/tmp/pixel/parakeet',
        percent: 100,
        requiredBytesLabel: '~461 MB',
        sourceUrl: 'https://huggingface.co/FluidInference/parakeet-tdt-0.6b-v3-coreml',
        status: 'installed',
        totalBytes: 483_103_089
      }),
      hasRuntime: () => true,
      platform: 'darwin'
    })

    expect(backend.getStatus()).toMatchObject({
      ready: true,
      status: 'ready'
    })
  })

  it('reports Linux Parakeet ONNX as not installed before the model is present', () => {
    const backend = new SherpaOnnxBackend({
      getModelSnapshot: () => createSherpaModelSnapshot({ status: 'not_installed' }),
      platform: 'linux'
    })

    expect(backend.getStatus()).toMatchObject({
      id: 'onnx-sherpa',
      label: 'Parakeet ONNX',
      ready: false,
      status: 'not_installed'
    })
  })

  it('reports Linux Parakeet ONNX as installing while the model downloads', () => {
    const backend = new SherpaOnnxBackend({
      getModelSnapshot: () =>
        createSherpaModelSnapshot({ message: 'Downloading required Parakeet ONNX assets...' }),
      platform: 'linux'
    })

    expect(backend.getStatus()).toMatchObject({
      message: 'Downloading required Parakeet ONNX assets...',
      ready: false,
      status: 'installing'
    })
  })

  it('reports Linux Parakeet ONNX runtime_missing when sherpa is unavailable', () => {
    const backend = new SherpaOnnxBackend({
      getModelSnapshot: () => createSherpaModelSnapshot({ status: 'installed' }),
      hasRuntime: () => false,
      platform: 'linux'
    })

    expect(backend.getStatus()).toMatchObject({
      ready: false,
      status: 'runtime_missing'
    })
  })

  it('reports Linux Parakeet ONNX ready when model and runtime are available', () => {
    const backend = new SherpaOnnxBackend({
      getModelSnapshot: () => createSherpaModelSnapshot({ status: 'installed' }),
      hasRuntime: () => true,
      platform: 'linux'
    })

    expect(backend.getStatus()).toMatchObject({
      ready: true,
      status: 'ready'
    })
  })

  it('rejects Linux transcription when Pixel has no audio path', async () => {
    const backend = new SherpaOnnxBackend({
      getModelSnapshot: () => createSherpaModelSnapshot({ status: 'installed' }),
      platform: 'linux',
      runtime: {
        isAvailable: () => true,
        transcribe: async () => ({ text: 'hello' })
      } as unknown as SherpaOnnxRuntime
    })

    await expect(backend.transcribe({ startedAt: 100, stoppedAt: 200 })).rejects.toThrow(
      'Pixel did not receive microphone audio to transcribe.'
    )
  })

  it('rejects Linux transcription when sherpa returns empty text', async () => {
    const backend = new SherpaOnnxBackend({
      getModelSnapshot: () => createSherpaModelSnapshot({ status: 'installed' }),
      platform: 'linux',
      runtime: {
        isAvailable: () => true,
        transcribe: async () => ({ text: '   ' })
      } as unknown as SherpaOnnxRuntime
    })

    await expect(
      backend.transcribe({
        audioFilePath: '/tmp/pixel-dictation.wav',
        startedAt: 100,
        stoppedAt: 200
      })
    ).rejects.toThrow('Parakeet ONNX returned an empty transcript.')
  })
})

function createSherpaModelSnapshot(
  overrides: Partial<DictationModelInstallSnapshot> = {}
): DictationModelInstallSnapshot {
  return {
    downloadedBytes: 367_000_000,
    installPath: '/tmp/pixel/sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8',
    percent: 100,
    requiredBytesLabel: '~350 MB',
    sourceUrl:
      'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8.tar.bz2',
    status: 'downloading',
    totalBytes: 367_000_000,
    ...overrides
  }
}
