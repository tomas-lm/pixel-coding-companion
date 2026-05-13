import type { CompanionStoreState } from '../../../shared/companionStore'

const DEV_COMPANION_LEVEL_OVERRIDES_KEY = 'pixel-companion-dev-level-overrides-v2'
const MAX_COMPANION_LEVEL = 100

type DevCompanionLevelOverrides = Record<string, number>

export function isDevCompanionLevelControlsEnabled(): boolean {
  return import.meta.env.DEV || import.meta.env.VITE_PIXEL_COMPANION_DEV_STORE_CONTROLS === 'true'
}

function clampLevel(level: number): number {
  return Math.min(Math.max(Math.floor(level), 0), MAX_COMPANION_LEVEL)
}

export function readDevCompanionLevelOverrides(): DevCompanionLevelOverrides {
  if (!isDevCompanionLevelControlsEnabled()) return {}

  try {
    const value = window.localStorage.getItem(DEV_COMPANION_LEVEL_OVERRIDES_KEY)
    if (!value) return {}

    const parsed = JSON.parse(value) as Record<string, unknown>
    return Object.fromEntries(
      Object.entries(parsed)
        .filter((entry): entry is [string, number] => {
          return typeof entry[0] === 'string' && typeof entry[1] === 'number'
        })
        .map(([companionId, level]) => [companionId, clampLevel(level)])
    )
  } catch {
    return {}
  }
}

export function saveDevCompanionLevelOverride(companionId: string, level: number): void {
  if (!isDevCompanionLevelControlsEnabled()) return

  const overrides = readDevCompanionLevelOverrides()
  window.localStorage.setItem(
    DEV_COMPANION_LEVEL_OVERRIDES_KEY,
    JSON.stringify({
      ...overrides,
      [companionId]: clampLevel(level)
    })
  )
}

export function applyDevCompanionLevelOverrides(
  storeState: CompanionStoreState
): CompanionStoreState {
  const overrides = readDevCompanionLevelOverrides()
  const overrideEntries = Object.entries(overrides)

  if (overrideEntries.length === 0) return storeState

  return {
    ...storeState,
    companions: {
      ...storeState.companions,
      ...Object.fromEntries(
        overrideEntries
          .filter(([companionId]) => storeState.companions[companionId]?.owned)
          .map(([companionId, level]) => {
            const companion = storeState.companions[companionId]
            const nextLevel = level

            return [
              companionId,
              {
                ...companion,
                currentXp: nextLevel === companion.level ? companion.currentXp : 0,
                level: nextLevel
              }
            ]
          })
      )
    }
  }
}
