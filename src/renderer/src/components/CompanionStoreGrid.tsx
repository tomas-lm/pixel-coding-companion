import type { CompanionCardState, CompanionDefinition } from '../companions/companionTypes'
import { CompanionStoreCard } from './CompanionStoreCard'

type CompanionStoreGridProps = {
  activeCompanionId: string
  companions: CompanionDefinition[]
  getCompanionState: (companion: CompanionDefinition) => CompanionCardState
  isDevLevelUpEnabled?: boolean
  onLevelDownCompanion?: (companion: CompanionDefinition) => void
  onLevelUpCompanion?: (companion: CompanionDefinition) => void
  onSelectCompanion: (companion: CompanionDefinition) => void
}

export function CompanionStoreGrid({
  activeCompanionId,
  companions,
  getCompanionState,
  isDevLevelUpEnabled = false,
  onLevelDownCompanion,
  onLevelUpCompanion,
  onSelectCompanion
}: CompanionStoreGridProps): React.JSX.Element {
  return (
    <div className="companion-store-grid">
      {companions.map((companion) => (
        <CompanionStoreCard
          key={companion.id}
          companion={companion}
          isDevLevelUpEnabled={isDevLevelUpEnabled}
          onLevelDown={onLevelDownCompanion}
          onLevelUp={onLevelUpCompanion}
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
