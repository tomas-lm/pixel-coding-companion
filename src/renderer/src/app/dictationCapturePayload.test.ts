import { describe, expect, it } from 'vitest'
import {
  arrayBufferToBase64,
  createSuccessfulDictationCaptureResult,
  serializeDictationCaptureResult
} from './dictationCapturePayload'

describe('dictationCapturePayload', () => {
  it('serializes successful capture audio as base64 for IPC', () => {
    const audioBytes = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00])

    expect(arrayBufferToBase64(audioBytes.buffer)).toBe('UklGRiQAAAA=')
    expect(
      createSuccessfulDictationCaptureResult({
        audioData: audioBytes.buffer,
        sampleRate: 16_000
      })
    ).toEqual({
      audioBase64: 'UklGRiQAAAA=',
      mimeType: 'audio/wav',
      ok: true,
      sampleRate: 16_000
    })
    expect(
      serializeDictationCaptureResult(
        createSuccessfulDictationCaptureResult({
          audioData: audioBytes.buffer,
          sampleRate: 16_000
        })
      )
    ).toBe('{"audioBase64":"UklGRiQAAAA=","mimeType":"audio/wav","ok":true,"sampleRate":16000}')
  })

  it('leaves failure payloads unchanged at the IPC boundary', () => {
    const failurePayload = {
      ok: false as const,
      reason: 'Could not finish microphone recording.'
    }

    expect(failurePayload).toEqual({
      ok: false,
      reason: 'Could not finish microphone recording.'
    })
    expect(serializeDictationCaptureResult(failurePayload)).toBe(
      '{"ok":false,"reason":"Could not finish microphone recording."}'
    )
  })
})
