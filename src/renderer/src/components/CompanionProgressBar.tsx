import type { CSSProperties } from 'react'
import type { CompanionProgress } from '../lib/companionProgress'

type CompanionProgressBarProps = {
  progress: CompanionProgress
}

export function CompanionProgressBar({ progress }: CompanionProgressBarProps): React.JSX.Element {
  const progressPercent = `${Math.round(progress.progressRatio * 100)}%`

  return (
    <section className="companion-progress" aria-label={`${progress.name} progress`}>
      <div className="companion-progress-header">
        <strong>{progress.name}</strong>
        <span>Lvl {progress.level}</span>
      </div>
      <div
        className="companion-progress-track"
        aria-label={`${progress.currentXp} of ${progress.xpForNextLevel} XP`}
        aria-valuemax={progress.xpForNextLevel}
        aria-valuemin={0}
        aria-valuenow={progress.currentXp}
        role="progressbar"
      >
        <span
          className="companion-progress-fill"
          style={{ '--companion-xp-progress': progressPercent } as CSSProperties}
        />
      </div>
      <small>
        {progress.currentXp}/{progress.xpForNextLevel} XP
      </small>
    </section>
  )
}
