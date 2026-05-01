import type { CompanionProgress } from '../lib/companionProgress'
import { COMPANION_REGISTRY, STARTER_COMPANION_ID } from '../companions/companionRegistry'
import type { CompanionCardState, CompanionDefinition } from '../companions/companionTypes'
import { CompanionStoreGrid } from './CompanionStoreGrid'
import { MonsterPointsBalance } from './MonsterPointsBalance'

type CompanionStorePageProps = {
  progress: CompanionProgress
}

export function CompanionStorePage({ progress }: CompanionStorePageProps): React.JSX.Element {
  const getCompanionState = (companion: CompanionDefinition): CompanionCardState => {
    const isStarter = companion.id === STARTER_COMPANION_ID

    return {
      currentXp: isStarter ? progress.currentXp : 0,
      level: isStarter ? progress.level : 0,
      monsterPoints: progress.monsterPoints,
      owned: isStarter,
      totalXp: isStarter ? progress.totalXp : 0
    }
  }

  return (
    <section className="companion-store-page" aria-label="Monster store">
      <header className="companion-store-header">
        <h1>Companion Store</h1>
        <MonsterPointsBalance monsterPoints={progress.monsterPoints} />
      </header>
      <CompanionStoreGrid companions={COMPANION_REGISTRY} getCompanionState={getCompanionState} />
    </section>
  )
}
