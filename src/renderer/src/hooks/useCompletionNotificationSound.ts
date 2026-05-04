import { useEffect, useRef } from 'react'
import type { CompanionBridgeMessage } from '../../../shared/companion'
import { playCompletionSound, shouldPlayCompletionSound } from '../app/notificationSounds'

export function useCompletionNotificationSound(
  messages: CompanionBridgeMessage[],
  enabled: boolean
): void {
  const hasHydratedRef = useRef(false)
  const latestMessageIdRef = useRef<string | null>(null)

  useEffect(() => {
    const latestMessage = messages.at(-1)

    if (!latestMessage) return

    const shouldPlay = shouldPlayCompletionSound({
      enabled,
      hasHydrated: hasHydratedRef.current,
      latestMessage,
      previousMessageId: latestMessageIdRef.current
    })

    latestMessageIdRef.current = latestMessage.id
    hasHydratedRef.current = true

    if (shouldPlay) {
      playCompletionSound()
    }
  }, [enabled, messages])
}
