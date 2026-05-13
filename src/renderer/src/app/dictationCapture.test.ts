import { afterEach, describe, expect, it, vi } from 'vitest'
import { getDictationAudioInputPermissionStatus } from './dictationCapture'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('dictationCapture permission status', () => {
  it('treats labeled audio input devices as granted microphone access', async () => {
    vi.stubGlobal('navigator', {
      mediaDevices: {
        enumerateDevices: vi.fn().mockResolvedValue([
          {
            deviceId: 'default',
            kind: 'audioinput',
            label: 'MacBook Pro Microphone'
          }
        ])
      }
    })

    await expect(getDictationAudioInputPermissionStatus()).resolves.toBe('granted')
  })

  it('treats unlabeled audio input devices as not yet prompted', async () => {
    vi.stubGlobal('navigator', {
      mediaDevices: {
        enumerateDevices: vi.fn().mockResolvedValue([
          {
            deviceId: 'default',
            kind: 'audioinput',
            label: ''
          }
        ])
      }
    })

    await expect(getDictationAudioInputPermissionStatus()).resolves.toBe('not-determined')
  })

  it('falls back to the browser permission query when device status is unavailable', async () => {
    vi.stubGlobal('navigator', {
      mediaDevices: {
        enumerateDevices: vi.fn().mockResolvedValue([])
      },
      permissions: {
        query: vi.fn().mockResolvedValue({ state: 'denied' })
      }
    })

    await expect(getDictationAudioInputPermissionStatus()).resolves.toBe('denied')
  })
})
