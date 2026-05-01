import { useState } from 'react'
import {
  COMPANION_BOX_DEFINITIONS,
  getLocalDateKey,
  type CompanionBoxDefinition,
  type CompanionBoxOpenResult,
  type CompanionStoreState
} from '../../../shared/companionStore'
import type { CompanionProgress } from '../lib/companionProgress'
import { COMPANION_REGISTRY, STARTER_COMPANION_ID } from '../companions/companionRegistry'
import type { CompanionCardState, CompanionDefinition } from '../companions/companionTypes'
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
  return error instanceof Error ? error.message : 'The box could not be opened.'
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
  const today = getLocalDateKey()

  const openBox = (boxId: string): void => {
    setOpeningBoxId(boxId)
    setStoreError(null)

    window.api.companion
      .openBox({ boxId })
      .then((result) => {
        onStoreStateUpdate(result.storeState)
        setRollResult(result)
        onProgressUpdate(result.progress)
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
        onStoreStateUpdate(result.storeState)
      })
      .catch((error: unknown) => {
        setStoreError(getErrorMessage(error))
      })
  }

  const getCompanionState = (companion: CompanionDefinition): CompanionCardState => {
    const isStarter = companion.id === STARTER_COMPANION_ID
    const companionState = storeState?.companions[companion.id]

    return {
      currentXp: isStarter ? progress.currentXp : (companionState?.currentXp ?? 0),
      level: isStarter ? progress.level : (companionState?.level ?? 0),
      monsterPoints: progress.monsterPoints,
      owned: isStarter || Boolean(companionState?.owned),
      selected: companion.id === activeCompanionId,
      totalXp: isStarter ? progress.totalXp : (companionState?.totalXp ?? 0)
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
