import { useEffect, useMemo, useRef, useState } from 'react'
import {
  TERMINAL_THEME_OPTIONS,
  type TerminalThemeId,
  type WorkspaceFeatureSettings
} from '../../../shared/workspace'

type ConfigsPanelProps = {
  featureSettings: WorkspaceFeatureSettings
  terminalThemeId: TerminalThemeId
  onChangeFeatureSettings: (featureSettings: WorkspaceFeatureSettings) => void
  onSelectTerminalTheme: (themeId: TerminalThemeId) => void
}

export function ConfigsPanel({
  featureSettings,
  terminalThemeId,
  onChangeFeatureSettings,
  onSelectTerminalTheme
}: ConfigsPanelProps): React.JSX.Element {
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false)
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
