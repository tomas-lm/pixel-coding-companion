import type { CompanionBridgeMessage } from '../../../shared/companion'

type AudioWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext
  }

type CompletionSoundOptions = {
  enabled: boolean
  hasHydrated: boolean
  latestMessage?: CompanionBridgeMessage
  previousMessageId: string | null
}

const COMPLETION_STATES = new Set<CompanionBridgeMessage['cliState']>([
  'done',
  'error',
  'waiting_input'
])

let audioContext: AudioContext | null = null

function getAudioContextConstructor(): typeof AudioContext | undefined {
  return window.AudioContext ?? (window as AudioWindow).webkitAudioContext
}

function getAudioContext(): AudioContext | null {
  const AudioContextConstructor = getAudioContextConstructor()

  if (!AudioContextConstructor) return null

  audioContext = audioContext ?? new AudioContextConstructor()

  return audioContext
}

export function isCompletionNotification(message?: CompanionBridgeMessage): boolean {
  return Boolean(message && COMPLETION_STATES.has(message.cliState))
}

export function shouldPlayCompletionSound({
  enabled,
  hasHydrated,
  latestMessage,
  previousMessageId
}: CompletionSoundOptions): boolean {
  return Boolean(
    enabled &&
    hasHydrated &&
    latestMessage &&
    latestMessage.id !== previousMessageId &&
    isCompletionNotification(latestMessage)
  )
}

export function primeCompletionSound(): void {
  const context = getAudioContext()

  if (!context) return

  void context.resume().catch(() => {
    audioContext = null
  })
}

export function playCompletionSound(): void {
  const context = getAudioContext()

  if (!context) return

  void context
    .resume()
    .then(() => {
      const startTime = context.currentTime
      const oscillator = context.createOscillator()
      const gain = context.createGain()

      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(587.33, startTime)
      oscillator.frequency.exponentialRampToValueAtTime(783.99, startTime + 0.08)

      gain.gain.setValueAtTime(0.0001, startTime)
      gain.gain.exponentialRampToValueAtTime(0.08, startTime + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.18)

      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start(startTime)
      oscillator.stop(startTime + 0.2)
    })
    .catch(() => {
      audioContext = null
    })
}
