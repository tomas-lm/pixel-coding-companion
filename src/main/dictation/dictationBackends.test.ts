import { describe, expect, it } from 'vitest'
import { getBackendStatus, selectPreferredDictationBackend } from './dictationBackends'

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
})
