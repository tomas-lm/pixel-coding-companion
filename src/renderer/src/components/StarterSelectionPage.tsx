import { useState } from 'react'
import { getCompanionStageForLevel } from '../companions/companionRegistry'
import type { CompanionDefinition } from '../companions/companionTypes'
import { CompanionAvatar } from './CompanionAvatar'

type StarterSelectionPageProps = {
  error: string | null
  isSaving: boolean
  onSelectStarter: (companionId: string) => Promise<void>
  starters: CompanionDefinition[]
}

export function StarterSelectionPage({
  error,
  isSaving,
  onSelectStarter,
  starters
}: StarterSelectionPageProps): React.JSX.Element {
  const [selectedStarterId, setSelectedStarterId] = useState(starters[0]?.id ?? '')
  const selectedStarter = starters.find((starter) => starter.id === selectedStarterId)

  return (
    <main className="starter-selection-shell">
      <section className="starter-selection-panel" aria-label="Choose starter companion">
        <header className="starter-selection-header">
          <span className="eyebrow">Pixel Companion</span>
          <h1>Choose your starter companion</h1>
          <p>Pick the first companion that will grow with your coding sessions.</p>
        </header>

        <div className="starter-selection-grid">
          {starters.map((starter) => {
            const isSelected = starter.id === selectedStarterId
            const eggStage = getCompanionStageForLevel(starter, 0)

            return (
              <button
                key={starter.id}
                className={`starter-selection-card${
                  isSelected ? ' starter-selection-card--selected' : ''
                }`}
                type="button"
                aria-pressed={isSelected}
                onClick={() => setSelectedStarterId(starter.id)}
              >
                <div className="starter-selection-card-art">
                  <CompanionAvatar
                    animated
                    className="starter-selection-card-avatar"
                    stage={eggStage}
                  />
                </div>
                <strong>{starter.name}</strong>
                <span>{starter.description}</span>
                <small>{starter.personalityHint}</small>
              </button>
            )
          })}
        </div>

        <p className="starter-selection-disclaimer">Eggs hatch at level 5.</p>

        <footer className="starter-selection-actions">
          {error && (
            <p className="starter-selection-error" role="alert">
              {error}
            </p>
          )}
          <button
            className="primary-button"
            type="button"
            disabled={!selectedStarter || isSaving}
            onClick={() => {
              if (selectedStarter) void onSelectStarter(selectedStarter.id)
            }}
          >
            {isSaving ? 'Starting...' : `Start with ${selectedStarter?.name ?? 'companion'}`}
          </button>
        </footer>
      </section>
    </main>
  )
}
