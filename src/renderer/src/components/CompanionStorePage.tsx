import { useState } from 'react'
import {
  COMPANION_BOX_DEFINITIONS,
  getLocalDateKey,
  type CompanionBoxDefinition,
  type CompanionBoxOpenResult,
  type CompanionStoreState
} from '../../../shared/companionStore'
import { createCompanionProgressSnapshot, type CompanionProgress } from '../lib/companionProgress'
import { COMPANION_REGISTRY, STARTER_COMPANION_ID } from '../companions/companionRegistry'
import type { CompanionCardState, CompanionDefinition } from '../companions/companionTypes'
import {
  applyDevCompanionLevelOverrides,
  saveDevCompanionLevelOverride
} from '../lib/devCompanionLevelOverrides'
import { CompanionBoxShelf } from './CompanionBoxShelf'
import { CompanionBoxOpeningOverlay } from './CompanionBoxOpeningOverlay'
import { CompanionStoreGrid } from './CompanionStoreGrid'
import { MonsterPointsBalance } from './MonsterPointsBalance'

type CompanionStorePageProps = {
  onStoreStateUpdate: (storeState: CompanionStoreState) => void
  onProgressUpdate: (progress: CompanionProgress) => void
  progress: CompanionProgress
  storeState: CompanionStoreState | null
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The store action could not be completed.'
}

function createProgressForStoreState(
  progress: CompanionProgress,
  storeState: CompanionStoreState
): CompanionProgress {
  const companionEntry = storeState.companions[storeState.activeCompanionId]
  const companion = COMPANION_REGISTRY.find(
    (candidate) => candidate.id === storeState.activeCompanionId
  )

  if (!companionEntry?.owned) return progress

  return createCompanionProgressSnapshot({
    currentXp: companionEntry.currentXp,
    level: companionEntry.level,
    monsterPoints: progress.monsterPoints,
    name: companion?.name ?? progress.name,
    totalXp: companionEntry.totalXp,
    updatedAt: companionEntry.updatedAt ?? progress.updatedAt
  })
}

export function CompanionStorePage({
  onStoreStateUpdate,
  onProgressUpdate,
  progress,
  storeState
}: CompanionStorePageProps): React.JSX.Element {
  const [openingBoxId, setOpeningBoxId] = useState<string | null>(null)
  const [rollResult, setRollResult] = useState<CompanionBoxOpenResult | null>(null)
  const [storeError, setStoreError] = useState<string | null>(null)
  const activeCompanionId = storeState?.activeCompanionId ?? STARTER_COMPANION_ID
  const isDevStoreControlsEnabled = import.meta.env.DEV
  const today = getLocalDateKey()

  const openBox = (boxId: string): void => {
    setOpeningBoxId(boxId)
    setStoreError(null)

    window.api.companion
      .openBox({ boxId })
      .then((result) => {
        const nextStoreState = applyDevCompanionLevelOverrides(result.storeState)
        const nextProgress = createProgressForStoreState(result.progress, nextStoreState)

        onStoreStateUpdate(nextStoreState)
        setRollResult({
          ...result,
          progress: nextProgress,
          storeState: nextStoreState
        })
        onProgressUpdate(nextProgress)
      })
      .catch((error: unknown) => {
        setStoreError(getErrorMessage(error))
      })
      .finally(() => {
        setOpeningBoxId(null)
      })
  }

  const selectCompanion = (companion: CompanionDefinition): void => {
    const companionState = getCompanionState(companion)
    if (!companionState.owned || companionState.selected) return

    setStoreError(null)
    window.api.companion
      .selectCompanion({ companionId: companion.id })
      .then((result) => {
        const nextStoreState = applyDevCompanionLevelOverrides(result.storeState)

        onStoreStateUpdate(nextStoreState)
        onProgressUpdate(createProgressForStoreState(progress, nextStoreState))
      })
      .catch((error: unknown) => {
        setStoreError(getErrorMessage(error))
      })
  }

  const setDevCompanionLevel = (companion: CompanionDefinition, level: number): void => {
    const companionState = getCompanionState(companion)
    if (!isDevStoreControlsEnabled || !storeState || !companionState.owned) {
      return
    }

    const nextLevel = Math.min(Math.max(Math.floor(level), 0), 100)
    if (nextLevel === companionState.level) return

    setStoreError(null)

    const currentEntry = storeState.companions[companion.id]
    const now = new Date().toISOString()
    const nextTotalXp = currentEntry?.totalXp ?? companionState.totalXp
    const nextStoreState: CompanionStoreState = {
      ...storeState,
      companions: {
        ...storeState.companions,
        [companion.id]: {
          currentXp: 0,
          level: nextLevel,
          owned: true,
          totalXp: nextTotalXp,
          unlockedAt: currentEntry?.unlockedAt ?? now,
          updatedAt: now
        }
      },
      updatedAt: now
    }

    saveDevCompanionLevelOverride(companion.id, nextLevel)
    onStoreStateUpdate(nextStoreState)

    if (companion.id === activeCompanionId) {
      onProgressUpdate(
        createCompanionProgressSnapshot({
          currentXp: 0,
          level: nextLevel,
          monsterPoints: progress.monsterPoints,
          name: companion.name,
          totalXp: nextTotalXp,
          updatedAt: now
        })
      )
    }
  }

  const levelCompanion = (companion: CompanionDefinition, direction: 1 | -1): void => {
    const companionState = getCompanionState(companion)
    setDevCompanionLevel(companion, companionState.level + direction)
  }

  const levelUpCompanion = (companion: CompanionDefinition): void => {
    levelCompanion(companion, 1)
  }

  const levelDownCompanion = (companion: CompanionDefinition): void => {
    levelCompanion(companion, -1)
  }

  const getCompanionState = (companion: CompanionDefinition): CompanionCardState => {
    const companionState = storeState?.companions[companion.id]

    return {
      currentXp: companionState?.currentXp ?? 0,
      level: companionState?.level ?? 0,
      monsterPoints: progress.monsterPoints,
      owned: Boolean(companionState?.owned),
      selected: companion.id === activeCompanionId,
      totalXp: companionState?.totalXp ?? 0
    }
  }

  const getBoxAvailability = (
    box: CompanionBoxDefinition
  ): { isAvailable: boolean; unavailableLabel?: string } => {
    if (box.claimCadence !== 'daily') return { isAvailable: true }

    return storeState?.dailyAccess.boxClaims[box.id] === today
      ? { isAvailable: false, unavailableLabel: 'Claimed' }
      : { isAvailable: true }
  }

  return (
    <section className="companion-store-page" aria-label="Monster store">
      <header className="companion-store-header">
        <h1>Companion Store</h1>
        <MonsterPointsBalance monsterPoints={progress.monsterPoints} />
      </header>

      <div className="companion-store-content">
        <section className="companion-store-section" aria-labelledby="companion-store-title">
          <div className="companion-store-section-header">
            <h2 id="companion-store-title">Companion Store</h2>
          </div>
          <CompanionStoreGrid
            activeCompanionId={activeCompanionId}
            companions={COMPANION_REGISTRY}
            getCompanionState={getCompanionState}
            isDevLevelUpEnabled={isDevStoreControlsEnabled}
            onLevelDownCompanion={levelDownCompanion}
            onLevelUpCompanion={levelUpCompanion}
            onSelectCompanion={selectCompanion}
          />
        </section>

        <section className="companion-store-section" aria-labelledby="companion-boxes-title">
          <div className="companion-store-section-header">
            <h2 id="companion-boxes-title">Companion Boxes</h2>
            {storeState?.dailyAccess && (
              <span className="companion-daily-meter">
                Daily streak {storeState.dailyAccess.currentStreak}
              </span>
            )}
          </div>
          {storeError && (
            <p className="companion-store-error" role="alert">
              {storeError}
            </p>
          )}
          <CompanionBoxShelf
            boxes={COMPANION_BOX_DEFINITIONS}
            disabled={openingBoxId !== null || rollResult !== null}
            getBoxAvailability={getBoxAvailability}
            openingBoxId={openingBoxId}
            monsterPoints={progress.monsterPoints}
            onOpenBox={openBox}
          />
        </section>
      </div>

      {rollResult && (
        <CompanionBoxOpeningOverlay
          result={rollResult}
          onClose={() => {
            setRollResult(null)
          }}
        />
      )}
    </section>
  )
}
