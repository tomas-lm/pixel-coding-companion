import type { CSSProperties, MouseEvent } from 'react'
import {
  formatCompanionRarity,
  formatMonsterPoints,
  getCompanionRarityColor,
  getCompanionPrice,
  isBoxOnlyRarity
} from '../companions/companionEconomy'
import { getCompanionStageForLevel } from '../companions/companionRegistry'
import type { CompanionCardState, CompanionDefinition } from '../companions/companionTypes'
import { CompanionAvatar } from './CompanionAvatar'

const RAYA_STORE_SCALE = 0.7
const RAYA_STORE_EGG_SCALE = 0.91

function getCompanionStoreStage(
  companion: CompanionDefinition,
  stage: ReturnType<typeof getCompanionStageForLevel>
): ReturnType<typeof getCompanionStageForLevel> {
  let avatarOffsetX = stage.avatarOffsetX
  let avatarOffsetY = stage.avatarOffsetY
  let avatarScale = stage.avatarScale

  if (stage.id === 'egg') {
    avatarOffsetX = companion.id === 'combot' ? stage.avatarOffsetX : (stage.avatarOffsetX ?? 0) + 2
    avatarScale = companion.id === 'touk' ? (stage.avatarScale ?? 1) * 0.9 : stage.avatarScale
  }

  if (companion.id === 'tata' && stage.id === 'egg') {
    avatarScale = (avatarScale ?? 1) * 0.85
  }

  if (companion.id === 'combot' && stage.id === 'egg') {
    avatarScale = (avatarScale ?? 1) * 0.97
  }

  if (companion.id === 'raya') {
    avatarScale =
      (avatarScale ?? 1) * (stage.id === 'egg' ? RAYA_STORE_EGG_SCALE : RAYA_STORE_SCALE)
  }

  if (companion.id === 'raya' && stage.id === 'egg') {
    avatarOffsetX = (avatarOffsetX ?? 0) + 2
  }

  if (
    companion.id === 'raya' &&
    (stage.id === 'lvl1' || stage.id === 'lvl2' || stage.id === 'lvl3')
  ) {
    avatarOffsetX = (avatarOffsetX ?? 0) - 24
  }

  if (companion.id === 'frogo' && stage.id === 'lvl3') {
    avatarOffsetX = (avatarOffsetX ?? 0) + 1
  }

  if (companion.id === 'ghou' && stage.id === 'egg') {
    avatarOffsetX = (avatarOffsetX ?? 0) + 3
  }

  if (companion.id === 'karpa') {
    if (stage.id === 'lvl1' || stage.id === 'lvl2') {
      avatarOffsetX = (avatarOffsetX ?? 0) - 45
      avatarScale = (avatarScale ?? 1) * 0.7
    }

    if (stage.id === 'lvl2' || stage.id === 'lvl3') {
      avatarOffsetY = companion.stages.find((candidate) => candidate.id === 'egg')?.avatarOffsetY
    }
  }

  return {
    ...stage,
    avatarOffsetX,
    avatarOffsetY,
    avatarScale
  }
}

type CompanionStoreCardProps = {
  companion: CompanionDefinition
  isDevLevelUpEnabled?: boolean
  onLevelDown?: (companion: CompanionDefinition) => void
  onLevelUp?: (companion: CompanionDefinition) => void
  onSelect: (companion: CompanionDefinition) => void
  state: CompanionCardState
}

export function CompanionStoreCard({
  companion,
  isDevLevelUpEnabled = false,
  onLevelDown,
  onLevelUp,
  onSelect,
  state
}: CompanionStoreCardProps): React.JSX.Element {
  const stage = getCompanionStageForLevel(companion, state.level)
  const storeStage = getCompanionStoreStage(companion, stage)
  const price = getCompanionPrice(companion.basePrice, companion.rarity)
  const priceLabel = (() => {
    if (companion.acquisition === 'starter') return 'Daily Box only'
    if (companion.acquisition === 'gifted') return 'Gifted only'
    if (companion.acquisition === 'box_only' || isBoxOnlyRarity(companion.rarity)) {
      return 'Box only'
    }

    return `${formatMonsterPoints(price)} MP`
  })()
  const rarityColor = getCompanionRarityColor(companion.rarity)
  const rarityLabel = formatCompanionRarity(companion.rarity)
  const cardClassName = [
    'companion-store-card',
    state.owned ? undefined : 'companion-store-card--locked',
    state.selected ? 'companion-store-card--selected' : undefined
  ]
    .filter(Boolean)
    .join(' ')

  const selectCompanion = (): void => {
    if (state.owned) {
      onSelect(companion)
    }
  }
  const canUseDevLevelUp = isDevLevelUpEnabled && state.owned
  const isDevLevelDownDisabled = state.level <= 0
  const isDevLevelUpDisabled = state.level >= 100
  const levelUpCompanion = (event: MouseEvent<HTMLButtonElement>): void => {
    event.preventDefault()
    event.stopPropagation()
    if (isDevLevelUpDisabled) return

    onLevelUp?.(companion)
  }
  const levelDownCompanion = (event: MouseEvent<HTMLButtonElement>): void => {
    event.preventDefault()
    event.stopPropagation()
    if (isDevLevelDownDisabled) return

    onLevelDown?.(companion)
  }

  return (
    <article
      className={cardClassName}
      aria-pressed={state.owned ? state.selected : undefined}
      role={state.owned ? 'button' : undefined}
      style={{ '--companion-rarity-color': rarityColor } as CSSProperties}
      tabIndex={state.owned ? 0 : undefined}
      onClick={selectCompanion}
      onKeyDown={(event) => {
        if (!state.owned || (event.key !== 'Enter' && event.key !== ' ')) return

        event.preventDefault()
        selectCompanion()
      }}
    >
      <div className="companion-store-card-art">
        <CompanionAvatar
          className="companion-store-card-avatar"
          isDimmed={!state.owned}
          stage={storeStage}
        />
        {!state.owned && (
          <span className="companion-store-lock" aria-label="Locked">
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M7 10v-2a5 5 0 0 1 10 0v2" />
              <path d="M6 10h12v10h-12z" />
              <path d="M12 14v2" />
            </svg>
          </span>
        )}
        {state.selected && (
          <span className="companion-store-selected" aria-label="Selected">
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M5 12.5l4.2 4.2 9.8-10" />
            </svg>
          </span>
        )}
        {canUseDevLevelUp && (
          <div className="companion-dev-level-controls">
            <button
              aria-label={`Level up ${companion.name}`}
              className="companion-dev-level-button"
              disabled={isDevLevelUpDisabled}
              title={state.level >= 100 ? 'Max level reached' : 'Level up companion'}
              type="button"
              onClick={levelUpCompanion}
              onKeyDown={(event) => {
                event.stopPropagation()
              }}
            >
              Lvl Up
            </button>
            <button
              aria-label={`Level down ${companion.name}`}
              className="companion-dev-level-button"
              disabled={isDevLevelDownDisabled}
              title={state.level <= 0 ? 'Minimum level reached' : 'Level down companion'}
              type="button"
              onClick={levelDownCompanion}
              onKeyDown={(event) => {
                event.stopPropagation()
              }}
            >
              Lvl Down
            </button>
          </div>
        )}
      </div>

      <div className="companion-store-card-meta">
        <strong>{companion.name}</strong>
        <div className="companion-store-card-meta-row">
          <span>{rarityLabel}</span>
        </div>
      </div>

      <div className="companion-store-card-hover">
        <strong>{companion.name}</strong>
        <span>{rarityLabel}</span>
        {state.owned ? (
          <small>{state.selected ? 'Selected' : `Lvl ${state.level}`}</small>
        ) : (
          <small>{priceLabel}</small>
        )}
      </div>
    </article>
  )
}
