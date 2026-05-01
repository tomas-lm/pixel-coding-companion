import type { CompanionBoxDefinition } from '../../../shared/companionStore'
import { CompanionBoxCard } from './CompanionBoxCard'

type CompanionBoxShelfProps = {
  boxes: CompanionBoxDefinition[]
  disabled?: boolean
  openingBoxId: string | null
  monsterPoints: number
  onOpenBox: (boxId: string) => void
}

export function CompanionBoxShelf({
  boxes,
  disabled = false,
  openingBoxId,
  monsterPoints,
  onOpenBox
}: CompanionBoxShelfProps): React.JSX.Element {
  return (
    <section className="companion-box-shelf" aria-label="Egg boxes">
      {boxes.map((box) => (
        <CompanionBoxCard
          key={box.id}
          box={box}
          disabled={disabled}
          isOpening={openingBoxId === box.id}
          monsterPoints={monsterPoints}
          onOpen={onOpenBox}
        />
      ))}
    </section>
  )
}
