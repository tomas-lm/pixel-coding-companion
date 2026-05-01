import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import type { CompanionBoxOpenResult } from '../../../shared/companionStore'
import {
  formatCompanionRarity,
  formatMonsterPoints,
  getCompanionRarityColor
} from '../companions/companionEconomy'
import { COMPANION_REGISTRY } from '../companions/companionRegistry'
import type { CompanionDefinition } from '../companions/companionTypes'

const REEL_CARD_WIDTH = 148
const REEL_CARD_GAP = 12
const REEL_RESULT_INDEX = 24
const REEL_TRAILING_ITEMS = 18
const REEL_ANIMATION_MS = 3200
const RESULT_REVEAL_DELAY_MS = REEL_ANIMATION_MS + 350

type CompanionBoxOpeningOverlayProps = {
  onClose: () => void
  result: CompanionBoxOpenResult
}

type ReelItem = Pick<CompanionDefinition, 'id' | 'name' | 'rarity'> & {
  reelId: string
}

function createReelItem(
  companion: Pick<CompanionDefinition, 'id' | 'name' | 'rarity'>,
  reelId: string
): ReelItem {
  return {
    id: companion.id,
    name: companion.name,
    rarity: companion.rarity,
    reelId
  }
}

function getGreatestCommonDivisor(left: number, right: number): number {
  let currentLeft = Math.abs(left)
  let currentRight = Math.abs(right)

  while (currentRight > 0) {
    const nextRight = currentLeft % currentRight
    currentLeft = currentRight
    currentRight = nextRight
  }

  return currentLeft
}

function getReelStep(companionCount: number, seed: number): number {
  const candidates = [3, 5, 7, 11, 13, 17]
  const rotatedCandidates = candidates
    .slice(seed % candidates.length)
    .concat(candidates.slice(0, seed % candidates.length))

  return (
    rotatedCandidates.find(
      (candidate) =>
        candidate % companionCount !== 0 &&
        getGreatestCommonDivisor(candidate, companionCount) === 1
    ) ?? 1
  )
}

function createReelItems(result: CompanionBoxOpenResult): ReelItem[] {
  const rollableCompanions = COMPANION_REGISTRY.filter(
    (companion) => companion.acquisition !== 'gifted' && companion.rarity !== 'starter'
  )
  const resultCompanion =
    COMPANION_REGISTRY.find((companion) => companion.id === result.opening.companionId) ??
    ({
      id: result.opening.companionId,
      name: result.opening.companionName,
      rarity: result.opening.rarity
    } satisfies Pick<CompanionDefinition, 'id' | 'name' | 'rarity'>)

  const seed = Array.from(result.opening.id).reduce((sum, character) => {
    return sum + character.charCodeAt(0)
  }, 0)
  const reelStep = getReelStep(rollableCompanions.length, seed)
  const getCompanionAt = (position: number): CompanionDefinition => {
    return rollableCompanions[(seed + position * reelStep) % rollableCompanions.length]
  }
  const leadingItems = Array.from({ length: REEL_RESULT_INDEX }, (_, index) => {
    const companion = getCompanionAt(index)

    return createReelItem(companion, `${companion.id}-before-${index}`)
  })
  const trailingItems = Array.from({ length: REEL_TRAILING_ITEMS }, (_, index) => {
    const companion = getCompanionAt(REEL_RESULT_INDEX + index + 1)

    return createReelItem(companion, `${companion.id}-after-${index}`)
  })

  return [
    ...leadingItems,
    createReelItem(resultCompanion, `${resultCompanion.id}-result`),
    ...trailingItems
  ]
}

export function CompanionBoxOpeningOverlay({
  onClose,
  result
}: CompanionBoxOpeningOverlayProps): React.JSX.Element {
  const [isRolling, setIsRolling] = useState(false)
  const [showResult, setShowResult] = useState(false)
  const reelItems = useMemo(() => createReelItems(result), [result])
  const finalOffset = REEL_RESULT_INDEX * (REEL_CARD_WIDTH + REEL_CARD_GAP) + REEL_CARD_WIDTH / 2
  const resultLabel = result.opening.isDuplicate
    ? `+${formatMonsterPoints(result.opening.duplicateXp)} XP on ${result.opening.companionName}`
    : result.opening.companionName
  const resultRarityColor = getCompanionRarityColor(result.opening.rarity)

  useEffect(() => {
    const animationFrame = window.requestAnimationFrame(() => {
      setIsRolling(true)
    })
    const resultTimer = window.setTimeout(() => {
      setShowResult(true)
    }, RESULT_REVEAL_DELAY_MS)

    return () => {
      window.cancelAnimationFrame(animationFrame)
      window.clearTimeout(resultTimer)
    }
  }, [result.opening.id])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && showResult) {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, showResult])

  return (
    <div className="companion-box-opening-overlay" role="presentation">
      <section
        className={`companion-box-opening-panel${showResult ? ' companion-box-opening-panel--result' : ''}`}
        aria-label="Opening companion box"
      >
        <header className="companion-box-opening-header">
          <span>Opening box</span>
          <strong>Rolling companion</strong>
        </header>

        <div className="companion-box-reel-window" aria-hidden={showResult}>
          <div className="companion-box-reel-marker" />
          <div
            className={`companion-box-reel-track${isRolling ? ' companion-box-reel-track--rolling' : ''}`}
            style={
              {
                '--reel-final-offset': `${finalOffset}px`
              } as CSSProperties
            }
          >
            {reelItems.map((item) => (
              <article
                key={item.reelId}
                className="companion-box-reel-card"
                style={
                  {
                    '--companion-rarity-color': getCompanionRarityColor(item.rarity)
                  } as CSSProperties
                }
              >
                <span className="companion-box-reel-egg" />
                <strong>{item.name}</strong>
                <small>{formatCompanionRarity(item.rarity)}</small>
              </article>
            ))}
          </div>
        </div>

        {showResult && (
          <div
            className="companion-box-result-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Companion box result"
            style={{ '--companion-rarity-color': resultRarityColor } as CSSProperties}
          >
            <span>You got</span>
            <strong>{resultLabel}</strong>
            <small>
              {result.opening.isDuplicate
                ? formatCompanionRarity(result.opening.rarity)
                : `${formatCompanionRarity(result.opening.rarity)} companion`}
            </small>
            <button type="button" onClick={onClose}>
              Done
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
