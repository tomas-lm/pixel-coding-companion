import type { CompanionProgress } from '../lib/companionProgress'
import type { CompanionStoreState } from '../../../shared/companionStore'
import { CompanionStorePage } from './CompanionStorePage'

type CompanionCatalogPanelProps = {
  onStoreStateUpdate: (storeState: CompanionStoreState) => void
  onProgressUpdate: (progress: CompanionProgress) => void
  progress: CompanionProgress
  storeState: CompanionStoreState | null
}

export function CompanionCatalogPanel({
  onStoreStateUpdate,
  onProgressUpdate,
  progress,
  storeState
}: CompanionCatalogPanelProps): React.JSX.Element {
  return (
    <section className="companion-catalog-panel" aria-label="Companion selector">
      <CompanionStorePage
        progress={progress}
        storeState={storeState}
        onProgressUpdate={onProgressUpdate}
        onStoreStateUpdate={onStoreStateUpdate}
      />
    </section>
  )
}
