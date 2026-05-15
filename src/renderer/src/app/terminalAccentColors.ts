import type { Project, TerminalConfig } from '../../../shared/workspace'

const DEFAULT_TERMINAL_ACCENT_COLOR = '#4ea1ff'

const TERMINAL_ACCENT_MIXES = [
  { amount: 0, target: '#ffffff' },
  { amount: 0.26, target: '#ffffff' },
  { amount: 0.2, target: '#000000' },
  { amount: 0.42, target: '#ffffff' },
  { amount: 0.34, target: '#000000' },
  { amount: 0.18, target: '#7fe7dc' },
  { amount: 0.2, target: '#ff8bd1' },
  { amount: 0.22, target: '#f7d56f' }
] as const

function clampColorChannel(value: number): number {
  return Math.min(255, Math.max(0, Math.round(value)))
}

function parseHexColor(color: string): [number, number, number] | null {
  const normalized = normalizeHexColor(color)
  if (!normalized) return null

  return [
    Number.parseInt(normalized.slice(1, 3), 16),
    Number.parseInt(normalized.slice(3, 5), 16),
    Number.parseInt(normalized.slice(5, 7), 16)
  ]
}

function toHexChannel(value: number): string {
  return clampColorChannel(value).toString(16).padStart(2, '0')
}

function mixHexColors(color: string, target: string, amount: number): string {
  const sourceRgb = parseHexColor(color)
  const targetRgb = parseHexColor(target)
  if (!sourceRgb || !targetRgb) return normalizeHexColor(color) ?? DEFAULT_TERMINAL_ACCENT_COLOR

  const mixed = sourceRgb.map((channel, index) => {
    return channel + (targetRgb[index] - channel) * amount
  })

  return `#${mixed.map(toHexChannel).join('')}`
}

function hashString(value: string): number {
  let hash = 0
  for (const character of value) {
    hash = (hash * 31 + character.charCodeAt(0)) % 9973
  }

  return hash
}

export function normalizeHexColor(value?: string | null): string | null {
  if (typeof value !== 'string') return null

  const trimmed = value.trim()
  return /^#[0-9a-f]{6}$/i.test(trimmed) ? trimmed.toLowerCase() : null
}

export function deriveTerminalAccentColor(
  projectColor: string,
  terminalIndex: number,
  terminalId = ''
): string {
  const baseColor = normalizeHexColor(projectColor) ?? DEFAULT_TERMINAL_ACCENT_COLOR
  const fallbackIndex = hashString(terminalId) % TERMINAL_ACCENT_MIXES.length
  const safeIndex =
    Number.isFinite(terminalIndex) && terminalIndex >= 0 ? terminalIndex : fallbackIndex
  const mix = TERMINAL_ACCENT_MIXES[safeIndex % TERMINAL_ACCENT_MIXES.length]

  return mixHexColors(baseColor, mix.target, mix.amount)
}

export function getTerminalAccentColor(
  config: TerminalConfig,
  project: Pick<Project, 'color'> | null,
  projectConfigs: TerminalConfig[] = [config],
  fallbackProjectColor = DEFAULT_TERMINAL_ACCENT_COLOR
): string {
  const explicitColor = normalizeHexColor(config.accentColor)
  if (explicitColor) return explicitColor

  const projectColor =
    normalizeHexColor(project?.color) ??
    normalizeHexColor(fallbackProjectColor) ??
    DEFAULT_TERMINAL_ACCENT_COLOR
  const siblingConfigs = projectConfigs.filter(
    (candidate) => candidate.projectId === config.projectId
  )
  const configIndex = siblingConfigs.findIndex((candidate) => candidate.id === config.id)

  return deriveTerminalAccentColor(projectColor, configIndex, config.id)
}
