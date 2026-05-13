import { describe, expect, it } from 'vitest'
import {
  createGrantedDictationMicrophonePermission,
  mergeMicrophonePermissionSnapshots,
  withMicrophoneCaptureError
} from './dictationPermission'

describe('dictationPermission', () => {
  it('lets confirmed browser microphone access override stale native prompt state', () => {
    expect(
      mergeMicrophonePermissionSnapshots(
        {
          canPrompt: true,
          message: 'Pixel needs microphone permission before local dictation can capture audio.',
          status: 'not-determined'
        },
        'granted'
      )
    ).toEqual(createGrantedDictationMicrophonePermission())
  })

  it('keeps a native granted state when the browser check is inconclusive', () => {
    const permission = createGrantedDictationMicrophonePermission()

    expect(mergeMicrophonePermissionSnapshots(permission, 'unknown')).toBe(permission)
  })

  it('shows the actual capture failure instead of a stale native message', () => {
    expect(
      withMicrophoneCaptureError(
        {
          canPrompt: true,
          message: 'Pixel needs microphone permission before local dictation can capture audio.',
          status: 'not-determined'
        },
        new Error('Permission denied by macOS.')
      )
    ).toMatchObject({
      message: 'Permission denied by macOS.',
      status: 'not-determined'
    })
  })
})
