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

          {dictationBackendMessage ? (
            <small className="dictation-config__notice">{dictationBackendMessage}</small>
          ) : null}

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

        <section className="dictation-config" aria-labelledby="dictation-microphone-title">
          <div className="dictation-config__section-header">
            <h2 id="dictation-microphone-title">Microphone</h2>
            <small
              className={`dictation-config__pill dictation-config__pill--${
                microphonePermission?.status ?? 'checking'
              }`}
            >
              {microphonePermissionLabel}
            </small>
          </div>

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
              <button className="secondary-button" type="button" onClick={onOpenMicrophoneSettings}>
                Open macOS settings
              </button>
            ) : null}
          </div>

          {microphonePermission?.message ? (
            <small className="dictation-config__notice">{microphonePermission.message}</small>
          ) : null}
        </section>

        <section className="dictation-config" aria-labelledby="dictation-model-title">
          <div className="dictation-config__section-header">
            <h2 id="dictation-model-title">Parakeet model</h2>
            <small className={`dictation-config__pill dictation-config__pill--${model.status}`}>
              {model.status.replace('_', ' ')}
            </small>
          </div>

          <p>
            Pixel downloads the required Parakeet Core ML assets directly into app data. Required
            package: {model.requiredBytesLabel}.
          </p>

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

          {model.message ? (
            <small className="dictation-config__notice" role="status">
              {model.message}
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
