import { useMemo, useState, type CSSProperties } from 'react'
import type {
  FolderPickResult,
  Project,
  SessionKind,
  TerminalConfig
} from '../../../shared/workspace'
import anthropicLogoUrl from '../assets/logos/anthropic.svg'
import cursorLogoUrl from '../assets/logos/cursor.svg'
import openAiLogoUrl from '../assets/logos/openai.svg'
import { normalizeWorkspaceFolderPath } from '../app/workspacePaths'

type CommandPreset = {
  id: 'cursor' | 'claude' | 'codex' | 'custom'
  name: string
  label: string
  baseCommand: string
  defaultTerminalName: string
  kind: SessionKind
  description: string
  accent: string
  icon: React.JSX.Element
}

export type OnboardingResult = {
  project: Project
  terminalConfig: TerminalConfig
}

type OnboardingFlowProps = {
  colors: string[]
  onComplete: (result: OnboardingResult) => Promise<void>
  onPickFolder: () => Promise<FolderPickResult>
}

type OnboardingStep = 'command' | 'workspace' | 'review'

const DEFAULT_CUSTOM_TERMINAL_NAME = 'Custom Agent'

const COMMAND_PRESETS: CommandPreset[] = [
  {
    id: 'cursor',
    name: 'Cursor CLI',
    label: 'IDE agent',
    baseCommand: 'agent',
    defaultTerminalName: 'Cursor Agent',
    kind: 'ai',
    description: 'Launch the Cursor command-line agent in your workspace.',
    accent: '#f5f5f5',
    icon: <img src={cursorLogoUrl} alt="" />
  },
  {
    id: 'claude',
    name: 'Claude Code',
    label: 'AI terminal',
    baseCommand: 'claude',
    defaultTerminalName: 'Claude Code',
    kind: 'ai',
    description: 'Start Claude Code with your selected flags.',
    accent: '#d97757',
    icon: <img src={anthropicLogoUrl} alt="" />
  },
  {
    id: 'codex',
    name: 'Codex',
    label: 'OpenAI agent',
    baseCommand: 'codex',
    defaultTerminalName: 'Codex',
    kind: 'ai',
    description: 'Open a Codex CLI session from the configured folder.',
    accent: '#7fe7dc',
    icon: <img src={openAiLogoUrl} alt="" />
  },
  {
    id: 'custom',
    name: 'Custom',
    label: 'Your command',
    baseCommand: '',
    defaultTerminalName: DEFAULT_CUSTOM_TERMINAL_NAME,
    kind: 'custom',
    description: 'Use any local CLI, IDE command, script, or agent.',
    accent: '#c084fc',
    icon: (
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <path d="M14 20h36v28H14z" fill="none" stroke="currentColor" strokeWidth="5" />
        <path
          d="m22 30 7 6-7 6M34 42h10"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="5"
        />
      </svg>
    )
  }
]

function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}

function composeCommand(baseCommand: string, parameters: string): string {
  return [baseCommand.trim(), parameters.trim()].filter(Boolean).join(' ')
}

function getPreset(id: CommandPreset['id']): CommandPreset {
  return COMMAND_PRESETS.find((preset) => preset.id === id) ?? COMMAND_PRESETS[0]
}

function getStepIndex(step: OnboardingStep): number {
  if (step === 'command') return 0
  if (step === 'workspace') return 1
  return 2
}

export function OnboardingFlow({
  colors,
  onComplete,
  onPickFolder
}: OnboardingFlowProps): React.JSX.Element {
  const [step, setStep] = useState<OnboardingStep>('command')
  const [selectedPresetId, setSelectedPresetId] = useState<CommandPreset['id'] | null>(null)
  const [terminalName, setTerminalName] = useState('')
  const [customCommand, setCustomCommand] = useState('')
  const [customKind, setCustomKind] = useState<SessionKind>('custom')
  const [parameters, setParameters] = useState('')
  const [workspaceName, setWorkspaceName] = useState('')
  const [workspaceDescription, setWorkspaceDescription] = useState('')
  const [workspaceColor, setWorkspaceColor] = useState(colors[0] ?? '#4ea1ff')
  const [workspaceFolder, setWorkspaceFolder] = useState<FolderPickResult>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const selectedPreset = selectedPresetId ? getPreset(selectedPresetId) : null
  const baseCommand =
    selectedPreset?.id === 'custom' ? customCommand : (selectedPreset?.baseCommand ?? '')
  const finalCommand = useMemo(
    () => composeCommand(baseCommand, parameters),
    [baseCommand, parameters]
  )
  const resolvedTerminalName =
    terminalName.trim() || selectedPreset?.defaultTerminalName || workspaceName.trim()
  const canContinueCommand =
    selectedPreset?.id === 'custom'
      ? Boolean(terminalName.trim() && customCommand.trim())
      : Boolean(selectedPreset && finalCommand)
  const canContinueWorkspace = Boolean(workspaceName.trim() && workspaceFolder)
  const activeStepIndex = getStepIndex(step)
  const isCustomCommandEditable = !selectedPreset || selectedPreset.id === 'custom'

  const resetCommandSelection = (): void => {
    setSelectedPresetId(null)
    setTerminalName('')
    setCustomCommand('')
    setParameters('')
    setCustomKind('custom')
  }

  const ensureCustomSelected = (): void => {
    setSelectedPresetId('custom')
    setTerminalName((currentName) => currentName || DEFAULT_CUSTOM_TERMINAL_NAME)
  }

  const applyPresetSelection = (preset: CommandPreset): void => {
    setSelectedPresetId(preset.id)
    setTerminalName(preset.defaultTerminalName)
    setParameters('')
    if (preset.id !== 'custom') {
      setCustomCommand('')
      setCustomKind('custom')
    }
  }

  const selectPreset = (preset: CommandPreset): void => {
    if (selectedPresetId === preset.id) {
      resetCommandSelection()
      return
    }
    applyPresetSelection(preset)
  }

  const pickWorkspaceFolder = async (): Promise<void> => {
    const folder = await onPickFolder()
    if (!folder) return

    setWorkspaceFolder(folder)
    setWorkspaceName((currentName) => currentName || folder.name)
  }

  const finishOnboarding = async (): Promise<void> => {
    if (!canContinueCommand || !canContinueWorkspace || isSaving || !workspaceFolder) return

    setIsSaving(true)
    setSaveError(null)
    const projectId = createId('project')
    const folderPath = normalizeWorkspaceFolderPath(workspaceFolder.path)
    const project: Project = {
      id: projectId,
      name: workspaceName.trim(),
      description: workspaceDescription.trim(),
      color: workspaceColor,
      defaultFolder: folderPath
    }
    const terminalConfig: TerminalConfig = {
      id: createId('terminal'),
      projectId,
      name: resolvedTerminalName.trim(),
      kind: selectedPreset?.id === 'custom' ? customKind : (selectedPreset?.kind ?? 'ai'),
      cwd: folderPath,
      commands: [finalCommand]
    }

    try {
      await onComplete({ project, terminalConfig })
    } catch (error) {
      setSaveError(`Failed to save setup: ${String(error)}`)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <main
      className="onboarding-shell"
      style={{ '--active-project-color': workspaceColor } as CSSProperties}
    >
      <section className="onboarding-panel" aria-label="Initial setup">
        <header className="onboarding-header">
          <div>
            <span className="eyebrow">Initial setup</span>
            <h1>Choose how Pixel Companion starts your agent.</h1>
            <p>Configure one command and one workspace. You can add more terminals after setup.</p>
          </div>
          <ol className="onboarding-steps" aria-label="Setup steps">
            {['Command', 'Workspace', 'Review'].map((label, index) => (
              <li
                key={label}
                className={
                  index === activeStepIndex
                    ? 'onboarding-step onboarding-step--active'
                    : 'onboarding-step'
                }
              >
                <span className="onboarding-step-index">{index + 1}.</span> {label}
              </li>
            ))}
          </ol>
        </header>

        {step === 'command' && (
          <div className="onboarding-content">
            <section className="setup-section">
              <div className="setup-section-header">
                <span className="eyebrow">Command</span>
                <h2>Select your CLI or IDE agent</h2>
              </div>
              <div className="preset-grid">
                {COMMAND_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    className={`preset-card${preset.id === selectedPresetId ? ' preset-card--selected' : ''}`}
                    style={{ '--preset-color': preset.accent } as CSSProperties}
                    type="button"
                    onClick={() => selectPreset(preset)}
                  >
                    <span className="preset-card-inner">
                      <span className="preset-card-face preset-card-front">
                        <span className={`preset-icon preset-icon--${preset.id}`}>
                          {preset.icon}
                        </span>
                        <strong>{preset.name}</strong>
                        <small>{preset.label}</small>
                      </span>
                      <span className="preset-card-face preset-card-back">
                        <code>{preset.baseCommand || 'type your command'}</code>
                        <small>{preset.description}</small>
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <section className="setup-section setup-section--compact">
              <div className="setup-field-grid">
                <label>
                  <span>Terminal name</span>
                  <input
                    value={terminalName}
                    onChange={(event) => setTerminalName(event.target.value)}
                    placeholder="Codex"
                  />
                </label>
                <label>
                  <span>Parameters</span>
                  <input
                    value={parameters}
                    onChange={(event) => setParameters(event.target.value)}
                    placeholder="--full-auto"
                  />
                </label>
              </div>
              <div className="parameter-examples" aria-label="Parameter examples">
                <button type="button" onClick={() => setParameters('--full-auto')}>
                  --full-auto
                </button>
                <button
                  type="button"
                  onClick={() => setParameters('--dangerously-skip-permissions')}
                >
                  --dangerously-skip-permissions
                </button>
                <button type="button" onClick={() => setParameters('--output-format json')}>
                  --output-format json
                </button>
              </div>
              <div className="custom-command-panel">
                <div>
                  <span className="eyebrow">Custom command</span>
                  <p>Did not find your tool? Type the command you want to run.</p>
                </div>
                <div className="setup-field-grid">
                  <label>
                    <span>Base command</span>
                    <input
                      disabled={!isCustomCommandEditable}
                      value={customCommand}
                      onChange={(event) => {
                        ensureCustomSelected()
                        setCustomCommand(event.target.value)
                      }}
                      onFocus={() => {
                        if (!isCustomCommandEditable) return
                        ensureCustomSelected()
                      }}
                      placeholder="my-agent"
                    />
                  </label>
                  <label>
                    <span>Kind</span>
                    <select
                      value={customKind}
                      onChange={(event) => setCustomKind(event.target.value as SessionKind)}
                    >
                      <option value="ai">AI</option>
                      <option value="custom">Custom</option>
                      <option value="dev_server">Dev server</option>
                      <option value="test">Test</option>
                      <option value="logs">Logs</option>
                    </select>
                  </label>
                </div>
              </div>
              <div className="section-divider" aria-hidden="true" />
              <div className="command-preview">
                <span>Final command</span>
                <code>{finalCommand || 'Select or type a command'}</code>
              </div>
            </section>
          </div>
        )}

        {step === 'workspace' && (
          <div className="onboarding-content onboarding-content--workspace">
            <section className="setup-section">
              <div className="setup-section-header">
                <span className="eyebrow">Workspace</span>
                <h2>Choose where this command should run</h2>
              </div>
              <div className="setup-field-grid">
                <label>
                  <span>Workspace name</span>
                  <input
                    value={workspaceName}
                    onChange={(event) => setWorkspaceName(event.target.value)}
                    placeholder="My project"
                  />
                </label>
                <label>
                  <span>Description</span>
                  <input
                    value={workspaceDescription}
                    onChange={(event) => setWorkspaceDescription(event.target.value)}
                    placeholder="Frontend, backend, agent work..."
                  />
                </label>
              </div>
              <div className="setup-field-grid">
                <label>
                  <span>Color</span>
                  <input
                    type="color"
                    value={workspaceColor}
                    onChange={(event) => setWorkspaceColor(event.target.value)}
                  />
                </label>
                <div className="folder-picker-row">
                  <span>Workspace folder</span>
                  <button className="secondary-button" type="button" onClick={pickWorkspaceFolder}>
                    Choose folder
                  </button>
                  <strong>{workspaceFolder?.path ?? 'No folder selected'}</strong>
                </div>
              </div>
            </section>
          </div>
        )}

        {step === 'review' && (
          <div className="onboarding-content onboarding-content--review">
            <section className="setup-section">
              <div className="setup-section-header">
                <span className="eyebrow">Review</span>
                <h2>Confirm your first setup</h2>
              </div>
              <dl className="review-list">
                <div>
                  <dt>Command</dt>
                  <dd>{selectedPreset?.name ?? 'Custom'}</dd>
                </div>
                <div>
                  <dt>Final command</dt>
                  <dd>
                    <code>{finalCommand}</code>
                  </dd>
                </div>
                <div>
                  <dt>Workspace</dt>
                  <dd>{workspaceName}</dd>
                </div>
                <div>
                  <dt>Folder</dt>
                  <dd>{workspaceFolder?.path}</dd>
                </div>
              </dl>
            </section>
          </div>
        )}

        <footer className="onboarding-actions">
          {saveError && <p className="onboarding-error">{saveError}</p>}
          <button
            className="secondary-button"
            type="button"
            disabled={step === 'command' || isSaving}
            onClick={() => setStep(step === 'review' ? 'workspace' : 'command')}
          >
            Back
          </button>
          {step === 'command' && (
            <button
              className="primary-button"
              type="button"
              disabled={!canContinueCommand}
              onClick={() => setStep('workspace')}
            >
              Continue
            </button>
          )}
          {step === 'workspace' && (
            <button
              className="primary-button"
              type="button"
              disabled={!canContinueWorkspace}
              onClick={() => setStep('review')}
            >
              Review setup
            </button>
          )}
          {step === 'review' && (
            <button
              className="primary-button"
              type="button"
              disabled={isSaving}
              onClick={finishOnboarding}
            >
              {isSaving ? 'Saving...' : 'Finish setup'}
            </button>
          )}
        </footer>
      </section>
    </main>
  )
}
