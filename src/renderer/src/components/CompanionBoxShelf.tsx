import type { CompanionBoxDefinition } from '../../../shared/companionStore'
import { CompanionBoxCard } from './CompanionBoxCard'

type CompanionBoxShelfProps = {
  boxes: CompanionBoxDefinition[]
  disabled?: boolean
  getBoxAvailability?: (box: CompanionBoxDefinition) => {
    isAvailable: boolean
    unavailableLabel?: string
  }
  openingBoxId: string | null
  monsterPoints: number
  onOpenBox: (boxId: string) => void
}

export function CompanionBoxShelf({
  boxes,
  disabled = false,
  getBoxAvailability,
  openingBoxId,
  monsterPoints,
  onOpenBox
}: CompanionBoxShelfProps): React.JSX.Element {
  return (
    <section className="companion-box-shelf" aria-label="Egg boxes">
      {boxes.map((box) => {
        const availability = getBoxAvailability?.(box) ?? { isAvailable: true }

        return (
          <CompanionBoxCard
            key={box.id}
            box={box}
            disabled={disabled}
            isAvailable={availability.isAvailable}
            isOpening={openingBoxId === box.id}
            monsterPoints={monsterPoints}
            unavailableLabel={availability.unavailableLabel}
            onOpen={onOpenBox}
          />
        )
      })}
    </section>
  )
}
