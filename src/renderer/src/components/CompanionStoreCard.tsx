import type { CSSProperties } from 'react'
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

type CompanionStoreCardProps = {
  companion: CompanionDefinition
  onSelect: (companion: CompanionDefinition) => void
  state: CompanionCardState
}

export function CompanionStoreCard({
  companion,
  onSelect,
  state
}: CompanionStoreCardProps): React.JSX.Element {
  const stage = getCompanionStageForLevel(companion, state.level)
  const storeStage =
    stage.id === 'egg'
      ? {
          ...stage,
          avatarOffsetX:
            companion.id === 'combot' ? stage.avatarOffsetX : (stage.avatarOffsetX ?? 0) + 2,
          avatarScale: companion.id === 'touk' ? (stage.avatarScale ?? 1) * 0.9 : stage.avatarScale
        }
      : stage
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
      </div>

      <div className="companion-store-card-meta">
        <strong>{companion.name}</strong>
        <span>{rarityLabel}</span>
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
