import type { CompanionCardState, CompanionDefinition } from '../companions/companionTypes'
import { CompanionStoreCard } from './CompanionStoreCard'

type CompanionStoreGridProps = {
  activeCompanionId: string
  companions: CompanionDefinition[]
  getCompanionState: (companion: CompanionDefinition) => CompanionCardState
  onSelectCompanion: (companion: CompanionDefinition) => void
}

export function CompanionStoreGrid({
  activeCompanionId,
  companions,
  getCompanionState,
  onSelectCompanion
}: CompanionStoreGridProps): React.JSX.Element {
  return (
    <div className="companion-store-grid">
      {companions.map((companion) => (
        <CompanionStoreCard
          key={companion.id}
          companion={companion}
          state={{
            ...getCompanionState(companion),
            selected: companion.id === activeCompanionId
          }}
          onSelect={onSelectCompanion}
        />
      ))}
    </div>
  )
}
