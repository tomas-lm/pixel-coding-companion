import { useState } from 'react'
import {
  DICTATION_SHORTCUT_OPTIONS,
  type DictationShortcutId,
  type DictationSnapshot
} from '../../../shared/dictation'
import type { WorkspaceFeatureSettings } from '../../../shared/workspace'

const PARAKEET_DOWNLOAD_SIZE_LABEL = '~2.7 GB'

type DictationPanelProps = {
  dictationSnapshot?: DictationSnapshot | null
  featureSettings: WorkspaceFeatureSettings
  onChangeFeatureSettings: (featureSettings: WorkspaceFeatureSettings) => void
  onDownloadParakeet: () => void
  onTestDictation: () => void
}

function getBackendStatusLabel(snapshot?: DictationSnapshot | null): string {
  if (!snapshot) return 'Checking'
  if (snapshot.backend.status === 'ready') return 'Ready'
  if (snapshot.backend.status === 'not_installed') return 'Not installed'
  if (snapshot.backend.status === 'installing') return 'Installing'
  if (snapshot.backend.status === 'failed') return 'Failed'

  return 'Unsupported'
}

export function DictationPanel({
  dictationSnapshot,
  featureSettings,
  onChangeFeatureSettings,
  onDownloadParakeet,
  onTestDictation
}: DictationPanelProps): React.JSX.Element {
  const [downloadNotice, setDownloadNotice] = useState<string | null>(null)
  const dictationBackendLabel = dictationSnapshot?.backend.label ?? 'Local backend'
  const dictationBackendStatus = getBackendStatusLabel(dictationSnapshot)
  const canRunDictationTest =
    featureSettings.localTranscriberEnabled && Boolean(dictationSnapshot?.backend.ready)

  const updateShortcut = (shortcutId: DictationShortcutId): void => {
    onChangeFeatureSettings({
      ...featureSettings,
      localTranscriberShortcut: shortcutId
    })
  }

  const downloadParakeet = (): void => {
    setDownloadNotice(
      `Opening Parakeet download. Expected Core ML package: ${PARAKEET_DOWNLOAD_SIZE_LABEL}.`
    )
    onDownloadParakeet()
  }

  return (
    <section className="dictation-panel" aria-label="Dictation">
      <header className="dictation-panel__header">
        <div>
          <h1>Dictation</h1>
          <p>Local voice input for Pixel text targets.</p>
        </div>
      </header>

      <div className="dictation-panel__body app-dark-scroll">
        <section className="dictation-config" aria-labelledby="dictation-enable-title">
          <div className="dictation-config__section-header">
            <h2 id="dictation-enable-title">Local transcriber</h2>
            <small
              className={`dictation-config__pill dictation-config__pill--${
                dictationSnapshot?.backend.status ?? 'checking'
              }`}
              role="status"
            >
              {dictationBackendStatus}
            </small>
          </div>

          <label className="feature-toggle feature-toggle--flat">
            <input
              type="checkbox"
              checked={featureSettings.localTranscriberEnabled}
              onChange={(event) =>
                onChangeFeatureSettings({
                  ...featureSettings,
                  localTranscriberEnabled: event.currentTarget.checked
                })
              }
            />
            <span>Enable local transcriber</span>
          </label>

          <div className="dictation-config__status">
            <div>
              <span>Backend</span>
              <strong>{dictationBackendLabel}</strong>
            </div>
          </div>

          <p>Audio is processed locally. Pixel does not send dictation audio to cloud APIs.</p>
        </section>

        <section className="dictation-config" aria-labelledby="dictation-bind-title">
          <div className="dictation-config__section-header">
            <h2 id="dictation-bind-title">Bind</h2>
            <strong>{dictationSnapshot?.shortcut ?? 'Control+Option'}</strong>
          </div>

          <div className="dictation-shortcut-options" role="radiogroup" aria-label="Dictation bind">
            {DICTATION_SHORTCUT_OPTIONS.map((shortcut) => {
              const isSelected = featureSettings.localTranscriberShortcut === shortcut.id

              return (
                <button
                  key={shortcut.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  className="dictation-shortcut-option"
                  onClick={() => updateShortcut(shortcut.id)}
                >
                  {shortcut.label}
                </button>
              )
            })}
          </div>
        </section>

        <section className="dictation-config" aria-labelledby="dictation-model-title">
          <div className="dictation-config__section-header">
            <h2 id="dictation-model-title">Parakeet model</h2>
            <small className="dictation-config__pill">Large download</small>
          </div>

          <p>
            Parakeet Core ML is expected to download about {PARAKEET_DOWNLOAD_SIZE_LABEL} before it
            can run fully offline.
          </p>

          <div className="dictation-config__actions">
            <button className="primary-button" type="button" onClick={downloadParakeet}>
              Download Parakeet ({PARAKEET_DOWNLOAD_SIZE_LABEL})
            </button>
            <button
              className="secondary-button"
              type="button"
              disabled={!canRunDictationTest}
              onClick={onTestDictation}
            >
              Test transcription
            </button>
          </div>

          {downloadNotice ? (
            <small className="dictation-config__notice" role="status">
              {downloadNotice}
            </small>
          ) : null}
        </section>

        <section className="dictation-config" aria-labelledby="dictation-debug-title">
          <h2 id="dictation-debug-title">Debug</h2>
          <label className="feature-toggle feature-toggle--flat">
            <input
              type="checkbox"
              checked={featureSettings.keepLastDictationAudioSample}
              onChange={(event) =>
                onChangeFeatureSettings({
                  ...featureSettings,
                  keepLastDictationAudioSample: event.currentTarget.checked
                })
              }
            />
            <span>Keep last audio sample for debugging</span>
          </label>

          {dictationSnapshot?.error ? (
            <small className="dictation-config__error" role="alert">
              {dictationSnapshot.error}
            </small>
          ) : null}
        </section>
      </div>
    </section>
  )
}
