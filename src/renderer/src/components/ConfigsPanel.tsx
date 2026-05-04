import type { WorkspaceFeatureSettings } from '../../../shared/workspace'

type ConfigsPanelProps = {
  featureSettings: WorkspaceFeatureSettings
  onChangeFeatureSettings: (featureSettings: WorkspaceFeatureSettings) => void
}

export function ConfigsPanel({
  featureSettings,
  onChangeFeatureSettings
}: ConfigsPanelProps): React.JSX.Element {
  return (
    <section className="configs-panel" aria-label="Configs">
      <header className="configs-header">
        <h1>Configs</h1>
      </header>

      <section className="configs-section" aria-labelledby="configs-features-title">
        <h2 id="configs-features-title">Features</h2>
        <label className="feature-toggle">
          <input
            type="checkbox"
            checked={featureSettings.playSoundsUponFinishing}
            onChange={(event) =>
              onChangeFeatureSettings({
                ...featureSettings,
                playSoundsUponFinishing: event.currentTarget.checked
              })
            }
          />
          <span>Play sounds upon finishing</span>
        </label>
      </section>
    </section>
  )
}
