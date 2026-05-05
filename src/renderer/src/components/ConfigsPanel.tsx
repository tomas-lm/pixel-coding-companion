import { useEffect, useMemo, useRef, useState } from 'react'
import { CODE_EDITOR_OPTIONS, type CodeEditorCheckResult } from '../../../shared/system'
import {
  TERMINAL_THEME_OPTIONS,
  type TerminalThemeId,
  type WorkspaceCodeEditorSettings,
  type WorkspaceFeatureSettings
} from '../../../shared/workspace'

type ConfigsPanelProps = {
  codeEditorSettings: WorkspaceCodeEditorSettings
  featureSettings: WorkspaceFeatureSettings
  terminalThemeId: TerminalThemeId
  onChangeCodeEditorSettings: (settings: WorkspaceCodeEditorSettings) => void
  onChangeFeatureSettings: (featureSettings: WorkspaceFeatureSettings) => void
  onSelectTerminalTheme: (themeId: TerminalThemeId) => void
}

export function ConfigsPanel({
  codeEditorSettings,
  featureSettings,
  terminalThemeId,
  onChangeCodeEditorSettings,
  onChangeFeatureSettings,
  onSelectTerminalTheme
}: ConfigsPanelProps): React.JSX.Element {
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false)
  const [isCheckingEditor, setIsCheckingEditor] = useState(false)
  const [editorCheckResult, setEditorCheckResult] = useState<CodeEditorCheckResult | null>(null)
  const [highlightedThemeId, setHighlightedThemeId] = useState<TerminalThemeId>(terminalThemeId)
  const themeDropdownRef = useRef<HTMLDivElement | null>(null)
  const optionRefs = useRef<Record<TerminalThemeId, HTMLButtonElement | null>>(
    Object.fromEntries(
      TERMINAL_THEME_OPTIONS.map((themeOption) => [themeOption.id, null] as const)
    ) as Record<TerminalThemeId, HTMLButtonElement | null>
  )
  const selectedThemeLabel =
    TERMINAL_THEME_OPTIONS.find((themeOption) => themeOption.id === terminalThemeId)?.label ??
    TERMINAL_THEME_OPTIONS[0].label
  const highlightedThemeOptionId = `theme-option-${highlightedThemeId}`
  const themeOptionIds = useMemo(
    () => TERMINAL_THEME_OPTIONS.map((themeOption) => themeOption.id),
    []
  )
  const selectedEditorLabel =
    CODE_EDITOR_OPTIONS.find((option) => option.id === codeEditorSettings.preferredEditor)?.label ??
    CODE_EDITOR_OPTIONS[0].label

  const getNextThemeId = (currentThemeId: TerminalThemeId, delta: number): TerminalThemeId => {
    const currentIndex = Math.max(themeOptionIds.indexOf(currentThemeId), 0)
    const nextIndex = (currentIndex + delta + themeOptionIds.length) % themeOptionIds.length

    return themeOptionIds[nextIndex]
  }

  const focusThemeOption = (themeId: TerminalThemeId): void => {
    const optionElement = optionRefs.current[themeId]
    optionElement?.focus()
    optionElement?.scrollIntoView?.({ block: 'nearest' })
  }

  const selectTheme = (themeId: TerminalThemeId): void => {
    onSelectTerminalTheme(themeId)
    setHighlightedThemeId(themeId)
    setIsThemeMenuOpen(false)
  }

  useEffect(() => {
    if (!isThemeMenuOpen) return
    focusThemeOption(highlightedThemeId)
  }, [highlightedThemeId, isThemeMenuOpen])

  useEffect(() => {
    if (!isThemeMenuOpen) return

    const onPointerDown = (event: PointerEvent): void => {
      if (!themeDropdownRef.current?.contains(event.target as Node)) {
        setIsThemeMenuOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setIsThemeMenuOpen(false)
      }
    }

    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isThemeMenuOpen])

  const visibleEditorCheckResult =
    editorCheckResult?.editor === codeEditorSettings.preferredEditor ? editorCheckResult : null

  const checkEditorCommand = async (): Promise<void> => {
    setIsCheckingEditor(true)

    try {
      const result = await window.api.system.checkCodeEditor({
        editor: codeEditorSettings.preferredEditor
      })
      setEditorCheckResult(result)
    } finally {
      setIsCheckingEditor(false)
    }
  }

  return (
    <section className="configs-panel" aria-label="Configs">
      <header className="configs-header">
        <h1>Configs</h1>
      </header>

      <div className="configs-sections app-dark-scroll">
        <section className="configs-section" aria-labelledby="configs-terminal-title">
          <h2 id="configs-terminal-title">Terminal</h2>
          <div className="theme-dropdown" ref={themeDropdownRef}>
            <button
              aria-activedescendant={isThemeMenuOpen ? highlightedThemeOptionId : undefined}
              aria-controls="theme-dropdown-menu"
              aria-expanded={isThemeMenuOpen}
              aria-haspopup="listbox"
              aria-label={`Theme ${selectedThemeLabel}`}
              className="theme-dropdown__trigger"
              role="combobox"
              type="button"
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                  event.preventDefault()
                  setIsThemeMenuOpen(true)
                  setHighlightedThemeId(
                    event.key === 'ArrowDown'
                      ? getNextThemeId(terminalThemeId, 1)
                      : getNextThemeId(terminalThemeId, -1)
                  )
                  return
                }
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  setIsThemeMenuOpen((currentIsOpen) => {
                    const nextIsOpen = !currentIsOpen
                    if (nextIsOpen) {
                      setHighlightedThemeId(terminalThemeId)
                    }
                    return nextIsOpen
                  })
                }
              }}
              onClick={() =>
                setIsThemeMenuOpen((currentIsOpen) => {
                  const nextIsOpen = !currentIsOpen
                  if (nextIsOpen) {
                    setHighlightedThemeId(terminalThemeId)
                  }
                  return nextIsOpen
                })
              }
            >
              <span>Theme</span>
              <strong>{selectedThemeLabel}</strong>
            </button>

            {isThemeMenuOpen && (
              <ul
                aria-label="Terminal themes"
                className="theme-dropdown__menu app-dark-scroll"
                id="theme-dropdown-menu"
                role="listbox"
                onKeyDown={(event) => {
                  if (event.key === 'ArrowDown') {
                    event.preventDefault()
                    setHighlightedThemeId((currentThemeId) => getNextThemeId(currentThemeId, 1))
                    return
                  }
                  if (event.key === 'ArrowUp') {
                    event.preventDefault()
                    setHighlightedThemeId((currentThemeId) => getNextThemeId(currentThemeId, -1))
                    return
                  }
                  if (event.key === 'Home') {
                    event.preventDefault()
                    setHighlightedThemeId(themeOptionIds[0])
                    return
                  }
                  if (event.key === 'End') {
                    event.preventDefault()
                    setHighlightedThemeId(themeOptionIds[themeOptionIds.length - 1])
                    return
                  }
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    selectTheme(highlightedThemeId)
                  }
                }}
              >
                {TERMINAL_THEME_OPTIONS.map((themeOption) => {
                  const isSelected = themeOption.id === terminalThemeId
                  const isHighlighted = themeOption.id === highlightedThemeId
                  const optionId = `theme-option-${themeOption.id}`

                  return (
                    <li key={themeOption.id}>
                      <button
                        id={optionId}
                        aria-selected={isSelected}
                        className="theme-dropdown__option"
                        role="option"
                        tabIndex={isHighlighted ? 0 : -1}
                        type="button"
                        ref={(element) => {
                          optionRefs.current[themeOption.id] = element
                        }}
                        onMouseEnter={() => setHighlightedThemeId(themeOption.id)}
                        onClick={() => selectTheme(themeOption.id)}
                      >
                        <span>{themeOption.label}</span>
                        {isSelected ? <small>Active</small> : null}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </section>

        <section className="configs-section" aria-labelledby="configs-code-editor-title">
          <h2 id="configs-code-editor-title">Code editor</h2>
          <div className="code-editor-config">
            <div>
              <span>External editor</span>
              <strong>{selectedEditorLabel}</strong>
            </div>
            <div className="code-editor-options" role="group" aria-label="External code editor">
              {CODE_EDITOR_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  aria-pressed={option.id === codeEditorSettings.preferredEditor}
                  type="button"
                  onClick={() =>
                    onChangeCodeEditorSettings({
                      preferredEditor: option.id
                    })
                  }
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p>
              Code files from terminal changes open in this editor. Markdown files still open in
              Pixel Vaults when they belong to a configured vault.
            </p>
            <div className="code-editor-check-row">
              <button
                className="secondary-button"
                type="button"
                disabled={isCheckingEditor}
                onClick={() => {
                  void checkEditorCommand()
                }}
              >
                {isCheckingEditor ? 'Checking...' : 'Check command'}
              </button>
              {visibleEditorCheckResult ? (
                <small
                  className={`code-editor-check-status${
                    visibleEditorCheckResult.ok ? ' code-editor-check-status--ok' : ''
                  }`}
                  role="status"
                >
                  {visibleEditorCheckResult.ok
                    ? `${visibleEditorCheckResult.label} found as ${visibleEditorCheckResult.command}`
                    : `${visibleEditorCheckResult.label} command was not found`}
                </small>
              ) : null}
            </div>
          </div>
        </section>

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
      </div>
    </section>
  )
}
