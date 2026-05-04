import { describe, expect, it } from 'vitest'
import type { CompanionBridgeMessage } from '../../../shared/companion'
import { isCompletionNotification, shouldPlayCompletionSound } from './notificationSounds'

function createMessage(overrides: Partial<CompanionBridgeMessage> = {}): CompanionBridgeMessage {
  return {
    cliState: 'done',
    createdAt: '2026-05-04T00:00:00.000Z',
    id: 'message-1',
    source: 'mcp',
    summary: 'Finished',
    title: 'Pixel',
    ...overrides
  }
}

describe('notificationSounds', () => {
  it('treats finished and actionable notifications as completion notifications', () => {
    expect(isCompletionNotification(createMessage({ cliState: 'done' }))).toBe(true)
    expect(isCompletionNotification(createMessage({ cliState: 'error' }))).toBe(true)
    expect(isCompletionNotification(createMessage({ cliState: 'waiting_input' }))).toBe(true)
    expect(isCompletionNotification(createMessage({ cliState: 'working' }))).toBe(false)
  })

  it('only plays for new completion notifications after hydration when enabled', () => {
    expect(
      shouldPlayCompletionSound({
        enabled: true,
        hasHydrated: false,
        latestMessage: createMessage(),
        previousMessageId: null
      })
    ).toBe(false)

    expect(
      shouldPlayCompletionSound({
        enabled: true,
        hasHydrated: true,
        latestMessage: createMessage({ id: 'message-2' }),
        previousMessageId: 'message-1'
      })
    ).toBe(true)

    expect(
      shouldPlayCompletionSound({
        enabled: true,
        hasHydrated: true,
        latestMessage: createMessage({ id: 'message-1' }),
        previousMessageId: 'message-1'
      })
    ).toBe(false)

    expect(
      shouldPlayCompletionSound({
        enabled: false,
        hasHydrated: true,
        latestMessage: createMessage({ id: 'message-2' }),
        previousMessageId: 'message-1'
      })
    ).toBe(false)
  })
})
