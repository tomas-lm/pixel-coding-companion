import { readFile } from 'fs/promises'
import type { CompanionBridgeMessage, CompanionBridgeState } from '../../shared/companion'

export function createDefaultCompanionBridgeState(): CompanionBridgeState {
  return {
    currentState: 'idle',
    messages: []
  }
}

export function normalizeCompanionBridgeState(value: unknown): CompanionBridgeState {
  if (!value || typeof value !== 'object') return createDefaultCompanionBridgeState()

  const state = value as Partial<CompanionBridgeState>
  const messages = Array.isArray(state.messages)
    ? (state.messages.filter((message) => {
        if (!message || typeof message !== 'object') return false

        const candidate = message as Partial<CompanionBridgeMessage>
        return (
          typeof candidate.id === 'string' &&
          typeof candidate.createdAt === 'string' &&
          typeof candidate.title === 'string' &&
          typeof candidate.summary === 'string'
        )
      }) as CompanionBridgeMessage[])
    : []

  return {
    currentState: state.currentState ?? 'idle',
    messages: messages.slice(-80),
    updatedAt: state.updatedAt
  }
}

export class CompanionBridgeStore {
  constructor(private readonly getBridgeStatePath: () => string) {}

  async load(): Promise<CompanionBridgeState> {
    try {
      const file = await readFile(this.getBridgeStatePath(), 'utf8')
      return normalizeCompanionBridgeState(JSON.parse(file))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return createDefaultCompanionBridgeState()
      }

      throw error
    }
  }
}
