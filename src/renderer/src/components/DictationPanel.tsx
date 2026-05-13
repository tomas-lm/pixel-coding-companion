import {
  DICTATION_SHORTCUT_OPTIONS,
  PARAKEET_COREML_MODEL_DOWNLOAD_SIZE_LABEL,
  PARAKEET_COREML_MODEL_URL,
  type DictationMicrophonePermissionSnapshot,
  type DictationShortcutId,
  type DictationSnapshot
} from '../../../shared/dictation'
import type { WorkspaceFeatureSettings } from '../../../shared/workspace'
import type { DictationAudioInputDevice } from '../app/dictationCapture'

type DictationPanelProps = {
  audioInputDevices: DictationAudioInputDevice[]
  dictationSnapshot?: DictationSnapshot | null
  featureSettings: WorkspaceFeatureSettings
  microphonePermission: DictationMicrophonePermissionSnapshot | null
  onChangeFeatureSettings: (featureSettings: WorkspaceFeatureSettings) => void
  onInstallParakeet: () => void
  onOpenMicrophoneSettings: () => void
  onRefreshAudioInputs: () => void
  onRequestMicrophonePermission: () => Promise<DictationMicrophonePermissionSnapshot>
  onTestDictation: () => void
}

function getBackendStatusLabel(snapshot?: DictationSnapshot | null): string {
  if (!snapshot) return 'Checking'
  if (snapshot.backend.status === 'ready') return 'Ready'
  if (snapshot.backend.status === 'not_installed') return 'Not installed'
  if (snapshot.backend.status === 'installing') return 'Installing'
  if (snapshot.backend.status === 'runtime_missing') return 'Runtime missing'
  if (snapshot.backend.status === 'failed') return 'Failed'

  return 'Unsupported'
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 MB'

  const mib = bytes / 1024 / 1024
  if (mib < 1024) return `${mib.toFixed(mib >= 100 ? 0 : 1)} MB`

  return `${(mib / 1024).toFixed(1)} GB`
}

function getMicrophonePermissionLabel(
  permission: DictationMicrophonePermissionSnapshot | null
): string {
  if (!permission) return 'Checking'
  if (permission.status === 'granted') return 'Allowed'
  if (permission.status === 'not-determined') return 'Needs access'
  if (permission.status === 'denied') return 'Blocked'
  if (permission.status === 'restricted') return 'Restricted'
  if (permission.status === 'unsupported') return 'System'

  return 'Unknown'
}

export function DictationPanel({
  audioInputDevices,
  dictationSnapshot,
  featureSettings,
  microphonePermission,
  onChangeFeatureSettings,
  onInstallParakeet,
  onOpenMicrophoneSettings,
  onRefreshAudioInputs,
  onRequestMicrophonePermission,
  onTestDictation
}: DictationPanelProps): React.JSX.Element {
  const dictationBackendLabel = dictationSnapshot?.backend.label ?? 'Local backend'
  const dictationBackendStatus = getBackendStatusLabel(dictationSnapshot)
  const dictationBackendMessage =
    dictationSnapshot?.backend.ready === false ? dictationSnapshot.backend.message : undefined
  const model = dictationSnapshot?.model ?? {
    downloadedBytes: 0,
    percent: 0,
    requiredBytesLabel: PARAKEET_COREML_MODEL_DOWNLOAD_SIZE_LABEL,
    sourceUrl: PARAKEET_COREML_MODEL_URL,
    status: 'not_installed' as const,
    totalBytes: 0
  }
  const isModelInstalling = model.status === 'checking' || model.status === 'downloading'
  const isModelInstalled = model.status === 'installed'
  const modelProgressLabel =
    model.totalBytes > 0
      ? `${formatBytes(model.downloadedBytes)} of ${formatBytes(model.totalBytes)}`
      : model.requiredBytesLabel
  const canRunDictationTest =
    featureSettings.localTranscriberEnabled && Boolean(dictationSnapshot?.backend.ready)
  const defaultAudioInputLabel =
    audioInputDevices.find((device) => device.isDefault)?.label ?? 'System default microphone'
  const microphonePermissionLabel = getMicrophonePermissionLabel(microphonePermission)
  const selectedAudioInputIsMissing =
    Boolean(featureSettings.localTranscriberAudioInputDeviceId) &&
    !audioInputDevices.some(
      (device) => device.deviceId === featureSettings.localTranscriberAudioInputDeviceId
    )

  const updateShortcut = (shortcutId: DictationShortcutId): void => {
    onChangeFeatureSettings({
      ...featureSettings,
      localTranscriberShortcut: shortcutId
    })
  }

  const updateAudioInput = (deviceId: string): void => {
    onChangeFeatureSettings({
      ...featureSettings,
      localTranscriberAudioInputDeviceId: deviceId || null
    })
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
        <section className="dictation-settings-group" aria-labelledby="dictation-enable-title">
          <h2 id="dictation-enable-title">Local Transcriber</h2>

          <div className="dictation-setting-row">
            <div className="dictation-setting-copy">
              <div className="dictation-setting-title-row">
                <h3>Enable voice input</h3>
                <small
                  className={`dictation-config__pill dictation-config__pill--${
                    dictationSnapshot?.backend.status ?? 'checking'
                  }`}
                  role="status"
                >
                  {dictationBackendStatus}
                </small>
              </div>
              <p>Use a hold-to-talk shortcut to insert local transcripts into Pixel.</p>
              {dictationBackendMessage ? (
                <small className="dictation-config__notice">{dictationBackendMessage}</small>
              ) : null}
            </div>

            <div className="dictation-setting-control">
              <label className="feature-toggle feature-toggle--flat dictation-inline-toggle">
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
            </div>
          </div>

          <div className="dictation-setting-row">
            <div className="dictation-setting-copy">
              <h3>Backend</h3>
              <p>Audio is processed locally. Pixel does not send dictation audio to cloud APIs.</p>
            </div>

            <div className="dictation-setting-control">
              <div className="dictation-config__status">
                <span>Runtime</span>
                <strong>{dictationBackendLabel}</strong>
              </div>
            </div>
          </div>
        </section>

        <section className="dictation-settings-group" aria-labelledby="dictation-bind-title">
          <h2 id="dictation-bind-title">Shortcut</h2>

          <div className="dictation-setting-row">
            <div className="dictation-setting-copy">
              <h3>Hold shortcut</h3>
              <p>Hold the selected bind to record. Release it to transcribe and insert text.</p>
            </div>

            <div className="dictation-setting-control">
              <strong className="dictation-setting-current">
                {dictationSnapshot?.shortcut ?? 'Control+Option'}
              </strong>
              <div
                className="dictation-shortcut-options"
                role="radiogroup"
                aria-label="Dictation bind"
              >
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
            </div>
          </div>
        </section>

        <section className="dictation-settings-group" aria-labelledby="dictation-microphone-title">
          <h2 id="dictation-microphone-title">Microphone</h2>

          <div className="dictation-setting-row">
            <div className="dictation-setting-copy">
              <div className="dictation-setting-title-row">
                <h3>Input device</h3>
                <small
                  className={`dictation-config__pill dictation-config__pill--${
                    microphonePermission?.status ?? 'checking'
                  }`}
                >
                  {microphonePermissionLabel}
                </small>
              </div>
              <p>Choose the microphone Pixel should use for local dictation capture.</p>
              {microphonePermission?.message ? (
                <small className="dictation-config__notice">{microphonePermission.message}</small>
              ) : null}
            </div>

            <div className="dictation-setting-control">
              <select
                className="dictation-config__select"
                aria-label="Dictation microphone"
                value={featureSettings.localTranscriberAudioInputDeviceId ?? ''}
                onChange={(event) => updateAudioInput(event.currentTarget.value)}
              >
                <option value="">{defaultAudioInputLabel}</option>
                {selectedAudioInputIsMissing ? (
                  <option value={featureSettings.localTranscriberAudioInputDeviceId ?? ''}>
                    Selected microphone
                  </option>
                ) : null}
                {audioInputDevices
                  .filter((device) => !device.isDefault && device.deviceId)
                  .map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label}
                    </option>
                  ))}
              </select>

              <div className="dictation-config__actions">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => void onRequestMicrophonePermission()}
                >
                  Allow microphone
                </button>
                <button className="secondary-button" type="button" onClick={onRefreshAudioInputs}>
                  Refresh inputs
                </button>
                {microphonePermission?.status === 'denied' ||
                microphonePermission?.status === 'restricted' ? (
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={onOpenMicrophoneSettings}
                  >
                    Open macOS settings
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <section className="dictation-settings-group" aria-labelledby="dictation-model-title">
          <h2 id="dictation-model-title">Parakeet Model</h2>

          <div className="dictation-setting-row">
            <div className="dictation-setting-copy">
              <div className="dictation-setting-title-row">
                <h3>Model assets</h3>
                <small className={`dictation-config__pill dictation-config__pill--${model.status}`}>
                  {model.status.replace('_', ' ')}
                </small>
              </div>
              <p>
                Pixel stores the local Parakeet Core ML package in app data. Required package:{' '}
                {model.requiredBytesLabel}.
              </p>
              {model.message ? (
                <small className="dictation-config__notice" role="status">
                  {model.message}
                </small>
              ) : null}
            </div>

            <div className="dictation-setting-control">
              {isModelInstalling || isModelInstalled ? (
                <div className="dictation-download-progress">
                  <div
                    className="dictation-download-progress__bar"
                    role="progressbar"
                    aria-label="Parakeet download progress"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={model.percent}
                  >
                    <span style={{ width: `${model.percent}%` }} />
                  </div>
                  <div className="dictation-download-progress__meta">
                    <strong>{model.percent.toFixed(model.percent % 1 === 0 ? 0 : 1)}%</strong>
                    <span>{modelProgressLabel}</span>
                  </div>
                  {model.currentFile ? <small>{model.currentFile}</small> : null}
                </div>
              ) : null}

              <div className="dictation-config__actions">
                <button
                  className="primary-button"
                  type="button"
                  disabled={isModelInstalling || isModelInstalled}
                  onClick={onInstallParakeet}
                >
                  {isModelInstalling
                    ? `Downloading ${model.percent.toFixed(0)}%`
                    : isModelInstalled
                      ? 'Parakeet installed'
                      : `Download Parakeet (${model.requiredBytesLabel})`}
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
            </div>
          </div>
        </section>

        <section className="dictation-settings-group" aria-labelledby="dictation-debug-title">
          <h2 id="dictation-debug-title">Debug</h2>

          <div className="dictation-setting-row">
            <div className="dictation-setting-copy">
              <h3>Audio sample</h3>
              <p>Keep the last local recording only while diagnosing microphone issues.</p>
              {dictationSnapshot?.error ? (
                <small className="dictation-config__error" role="alert">
                  {dictationSnapshot.error}
                </small>
              ) : null}
            </div>

            <div className="dictation-setting-control">
              <label className="feature-toggle feature-toggle--flat dictation-inline-toggle">
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
            </div>
          </div>
        </section>
      </div>
    </section>
  )
}
