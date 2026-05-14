import type { DictationCaptureResult } from '../../../shared/dictation'

type SuccessfulWavCapture = {
  audioData: ArrayBuffer
  sampleRate: number
}

const BASE64_CHUNK_SIZE = 0x8000

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''

  for (let index = 0; index < bytes.length; index += BASE64_CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(index, index + BASE64_CHUNK_SIZE))
  }

  return btoa(binary)
}

export function createSuccessfulDictationCaptureResult({
  audioData,
  sampleRate
}: SuccessfulWavCapture): DictationCaptureResult {
  return {
    audioBase64: arrayBufferToBase64(audioData),
    mimeType: 'audio/wav',
    ok: true,
    sampleRate
  }
}

export function serializeDictationCaptureResult(result: DictationCaptureResult): string {
  return JSON.stringify(result)
}
