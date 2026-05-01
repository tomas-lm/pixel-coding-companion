import type { CompanionBoxDefinition } from '../../../shared/companionStore'
import { formatCompanionRarity, formatMonsterPoints } from '../companions/companionEconomy'

type CompanionBoxCardProps = {
  box: CompanionBoxDefinition
  disabled: boolean
  isOpening: boolean
  monsterPoints: number
  onOpen: (boxId: string) => void
}

function getOddsLabel(box: CompanionBoxDefinition): string {
  const totalWeight = box.odds.reduce((sum, entry) => sum + entry.weight, 0)

  return box.odds
    .map((entry) => {
      const percentage = totalWeight > 0 ? (entry.weight / totalWeight) * 100 : 0
      const formattedPercentage =
        percentage < 1 ? percentage.toFixed(1) : Math.round(percentage).toString()

      return `${formatCompanionRarity(entry.rarity)} ${formattedPercentage}%`
    })
    .join(' / ')
}

export function CompanionBoxCard({
  box,
  disabled,
  isOpening,
  monsterPoints,
  onOpen
}: CompanionBoxCardProps): React.JSX.Element {
  const canOpen = monsterPoints >= box.price && !disabled
  const buttonLabel = isOpening
    ? 'Opening'
    : canOpen
      ? 'Open box'
      : disabled
        ? 'Waiting'
        : 'Need MP'

  return (
    <article className="companion-box-card">
      <div className="companion-box-card-icon" aria-hidden="true">
        <span />
      </div>

      <div className="companion-box-card-copy">
        <strong>{box.name}</strong>
        <small>{formatMonsterPoints(box.price)} MP</small>
      </div>

      <button
        className="companion-box-card-button"
        type="button"
        disabled={!canOpen || isOpening}
        onClick={() => onOpen(box.id)}
      >
        {buttonLabel}
      </button>

      <div className="companion-box-card-hover">
        <strong>Drop odds</strong>
        <span>{getOddsLabel(box)}</span>
      </div>
    </article>
  )
}
