import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import type { CompanionBridgeState, CompanionProgressState } from '../../../shared/companion'
import type { CompanionStoreState } from '../../../shared/companionStore'
import { COMPANION_REGISTRY } from '../companions/companionRegistry'
import { createCompanionProgressSnapshot } from '../lib/companionProgress'
import { applyDevCompanionLevelOverrides } from '../lib/devCompanionLevelOverrides'

const DEFAULT_COMPANION_BRIDGE_STATE: CompanionBridgeState = {
  currentState: 'idle',
  messages: []
}

type UseCompanionBridgeResult = {
  companionBridgeState: CompanionBridgeState
  companionProgress: CompanionProgressState
  companionStoreLoaded: boolean
  companionStoreState: CompanionStoreState | null
  setCompanionProgress: Dispatch<SetStateAction<CompanionProgressState>>
  setCompanionStoreState: Dispatch<SetStateAction<CompanionStoreState | null>>
}

export function useCompanionBridge(defaultCompanionName: string): UseCompanionBridgeResult {
  const [companionBridgeState, setCompanionBridgeState] = useState<CompanionBridgeState>(
    DEFAULT_COMPANION_BRIDGE_STATE
  )
  const [companionProgress, setCompanionProgress] = useState<CompanionProgressState>(
    createCompanionProgressSnapshot({
      currentXp: 0,
      level: 0,
      name: defaultCompanionName
    })
  )
  const [companionStoreState, setCompanionStoreState] = useState<CompanionStoreState | null>(null)
  const [companionStoreLoaded, setCompanionStoreLoaded] = useState(false)

  useEffect(() => {
    let mounted = true

    const loadBridgeState = (): void => {
      void Promise.all([
        window.api.companion.loadBridgeState(),
        window.api.companion.loadProgress(),
        window.api.companion.loadStoreState()
      ])
        .then(([bridgeState, progress, storeState]) => {
          if (!mounted) return

          const nextStoreState = applyDevCompanionLevelOverrides(storeState)
          const activeEntry = nextStoreState.companions[nextStoreState.activeCompanionId]
          const activeCompanion = COMPANION_REGISTRY.find(
            (companion) => companion.id === nextStoreState.activeCompanionId
          )

          setCompanionBridgeState(bridgeState)
          setCompanionProgress(
            activeEntry?.owned
              ? createCompanionProgressSnapshot({
                  currentXp: activeEntry.currentXp,
                  level: activeEntry.level,
                  monsterPoints: progress.monsterPoints,
                  name: activeCompanion?.name ?? progress.name,
                  totalXp: activeEntry.totalXp,
                  updatedAt: activeEntry.updatedAt ?? progress.updatedAt
                })
              : progress
          )
          setCompanionStoreState(nextStoreState)
          setCompanionStoreLoaded(true)
        })
        .catch((error: unknown) => {
          console.error('Failed to load companion state', error)
          if (mounted) setCompanionStoreLoaded(true)
        })
    }

    loadBridgeState()
    const bridgeTimer = window.setInterval(loadBridgeState, 1200)

    return () => {
      mounted = false
      window.clearInterval(bridgeTimer)
    }
  }, [])

  return {
    companionBridgeState,
    companionProgress,
    companionStoreLoaded,
    companionStoreState,
    setCompanionProgress,
    setCompanionStoreState
  }
}
