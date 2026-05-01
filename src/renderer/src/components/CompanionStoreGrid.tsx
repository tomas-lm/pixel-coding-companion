import type { CompanionCardState, CompanionDefinition } from '../companions/companionTypes'
import { CompanionStoreCard } from './CompanionStoreCard'

type CompanionStoreGridProps = {
  companions: CompanionDefinition[]
  getCompanionState: (companion: CompanionDefinition) => CompanionCardState
}

export function CompanionStoreGrid({
  companions,
  getCompanionState
}: CompanionStoreGridProps): React.JSX.Element {
  return (
    <div className="companion-store-grid">
      {companions.map((companion) => (
        <CompanionStoreCard
          key={companion.id}
          companion={companion}
          state={getCompanionState(companion)}
        />
      ))}
    </div>
  )
}
