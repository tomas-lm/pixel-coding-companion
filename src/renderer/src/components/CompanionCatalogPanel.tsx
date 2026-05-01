import type { CompanionProgress } from '../lib/companionProgress'
import { CompanionStorePage } from './CompanionStorePage'

type CompanionCatalogPanelProps = {
  progress: CompanionProgress
}

export function CompanionCatalogPanel({ progress }: CompanionCatalogPanelProps): React.JSX.Element {
  return (
    <section className="companion-catalog-panel" aria-label="Companion selector">
      <CompanionStorePage progress={progress} />
    </section>
  )
}
