import {
  formatCompanionRarity,
  formatMonsterPoints,
  getCompanionPrice
} from '../companions/companionEconomy'
import { getCompanionStageForLevel } from '../companions/companionRegistry'
import type { CompanionCardState, CompanionDefinition } from '../companions/companionTypes'
import { CompanionAvatar } from './CompanionAvatar'

type CompanionStoreCardProps = {
  companion: CompanionDefinition
  state: CompanionCardState
}

export function CompanionStoreCard({
  companion,
  state
}: CompanionStoreCardProps): React.JSX.Element {
  const stage = getCompanionStageForLevel(companion, state.level)
  const price = getCompanionPrice(companion.basePrice, companion.rarity)
  const rarityLabel = formatCompanionRarity(companion.rarity)

  return (
    <article
      className={`companion-store-card${state.owned ? '' : ' companion-store-card--locked'}`}
    >
      <div className="companion-store-card-art">
        <CompanionAvatar
          className="companion-store-card-avatar"
          isDimmed={!state.owned}
          stage={stage}
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
      </div>

      <div className="companion-store-card-meta">
        <strong>{companion.name}</strong>
        <span>{rarityLabel}</span>
      </div>

      <div className="companion-store-card-hover">
        <strong>{companion.name}</strong>
        <span>{rarityLabel}</span>
        {state.owned ? (
          <small>Lvl {state.level}</small>
        ) : (
          <small>{formatMonsterPoints(price)} MP</small>
        )}
      </div>
    </article>
  )
}
