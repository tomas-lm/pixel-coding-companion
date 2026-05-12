import { describe, expect, it } from 'vitest'
import {
  ParakeetCoreMlBackend,
  getBackendStatus,
  selectPreferredDictationBackend
} from './dictationBackends'

describe('dictationBackends', () => {
  it('selects Parakeet CoreML as the preferred macOS backend', () => {
    expect(selectPreferredDictationBackend('darwin')).toBe('macos-parakeet-coreml')
  })

  it('selects ONNX sherpa for future Windows and Linux support', () => {
    expect(selectPreferredDictationBackend('win32')).toBe('onnx-sherpa')
    expect(selectPreferredDictationBackend('linux')).toBe('onnx-sherpa')
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
})
