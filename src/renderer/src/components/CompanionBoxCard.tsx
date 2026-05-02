import type { CompanionBoxDefinition } from '../../../shared/companionStore'
import { getCompanionBoxImage } from '../boxes/companionBoxImages'
import { formatCompanionRarity, formatMonsterPoints } from '../companions/companionEconomy'
import { CompanionBoxImage } from './CompanionBoxImage'

type CompanionBoxCardProps = {
  box: CompanionBoxDefinition
  disabled: boolean
  isAvailable?: boolean
  isOpening: boolean
  monsterPoints: number
  onOpen: (boxId: string) => void
  unavailableLabel?: string
}

function getOddsLabel(box: CompanionBoxDefinition): string {
  const totalWeight = box.odds.reduce((sum, entry) => sum + entry.weight, 0)

  return box.odds
    .map((entry) => {
      const percentage = totalWeight > 0 ? (entry.weight / totalWeight) * 100 : 0
      const formattedPercentage =
        percentage < 0.1
          ? percentage.toFixed(2)
          : percentage < 1
            ? percentage.toFixed(1)
            : Math.round(percentage).toString()

      return `${formatCompanionRarity(entry.rarity)} ${formattedPercentage}%`
    })
    .join(' / ')
}

export function CompanionBoxCard({
  box,
  disabled,
  isAvailable = true,
  isOpening,
  monsterPoints,
  onOpen,
  unavailableLabel = 'Unavailable'
}: CompanionBoxCardProps): React.JSX.Element {
  const hasEnoughMp = monsterPoints >= box.price
  const canOpen = hasEnoughMp && !disabled && isAvailable
  const buttonLabel = isOpening
    ? 'Opening'
    : canOpen
      ? box.claimCadence === 'daily'
        ? 'Claim daily'
        : 'Open box'
      : !isAvailable
        ? unavailableLabel
        : disabled
          ? 'Waiting'
          : 'Need MP'
  const priceLabel =
    box.claimCadence === 'daily' ? 'Free daily' : `${formatMonsterPoints(box.price)} MP`
  const boxImage = getCompanionBoxImage(box.id)

  return (
    <article className="companion-box-card">
      <div className="companion-box-card-icon" aria-hidden="true">
        <CompanionBoxImage image={boxImage} name={box.name} />
      </div>

      <div className="companion-box-card-copy">
        <strong>{box.name}</strong>
        <small>{priceLabel}</small>
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
