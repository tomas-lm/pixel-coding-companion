import type { CompanionBridgeMessage, CompanionProgressState } from '../../../shared/companion'
import type { CompanionStoreState } from '../../../shared/companionStore'
import type { Project, TerminalConfig } from '../../../shared/workspace'
import { COMPANION_REGISTRY, STARTER_COMPANION_ID } from '../companions/companionRegistry'
import { createCompanionProgressSnapshot } from '../lib/companionProgress'
import { getTerminalAccentColor, normalizeHexColor } from './terminalAccentColors'

export function getActiveCompanionProgress(
  progress: CompanionProgressState,
  storeState: CompanionStoreState | null
): CompanionProgressState {
  const activeCompanionId = storeState?.activeCompanionId ?? STARTER_COMPANION_ID
  const activeCompanion =
    COMPANION_REGISTRY.find((companion) => companion.id === activeCompanionId) ??
    COMPANION_REGISTRY[0]

  const activeCompanionState = storeState?.companions[activeCompanion.id]

  return createCompanionProgressSnapshot({
    currentXp: activeCompanionState?.currentXp ?? 0,
    level: activeCompanionState?.level ?? 0,
    monsterPoints: progress.monsterPoints,
    name: activeCompanion.name,
    totalXp: activeCompanionState?.totalXp ?? 0,
    updatedAt: activeCompanionState?.updatedAt
  })
}

function normalizeProjectKey(value?: string): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function getProjectForCompanionMessage(
  message: CompanionBridgeMessage,
  projects: Project[],
  terminalConfigs: TerminalConfig[]
): Project | null {
  if (message.projectId) {
    const project = projects.find((candidate) => candidate.id === message.projectId)
    if (project) return project
  }

  const terminal = getTerminalForCompanionMessage(message, terminalConfigs)
  if (terminal) {
    const project = terminal
      ? projects.find((candidate) => candidate.id === terminal.projectId)
      : null

    if (project) return project
  }

  if (message.cwd) {
    const cwd = message.cwd
    const terminal = terminalConfigs
      .filter((config) => config.cwd)
      .filter((config) => cwd === config.cwd || cwd.startsWith(`${config.cwd}/`))
      .sort((left, right) => right.cwd.length - left.cwd.length)[0]
    const project = terminal
      ? projects.find((candidate) => candidate.id === terminal.projectId)
      : null

    if (project) return project
  }

  const sessionName = normalizeProjectKey(message.sessionName ?? message.title)
  if (sessionName) {
    const terminal = terminalConfigs.find((config) => {
      const terminalName = normalizeProjectKey(config.name)
      return terminalName && (terminalName === sessionName || sessionName.includes(terminalName))
    })
    const project = terminal
      ? projects.find((candidate) => candidate.id === terminal.projectId)
      : null

    if (project) return project
  }

  const projectName = normalizeProjectKey(message.projectName)
  if (projectName) {
    const project =
      projects.find((candidate) => normalizeProjectKey(candidate.name) === projectName) ??
      projects.find((candidate) => {
        const candidateName = normalizeProjectKey(candidate.name)
        return (
          candidateName &&
          (candidateName.includes(projectName) || projectName.includes(candidateName))
        )
      })

    if (project) return project
  }

  return null
}

export function getTerminalForCompanionMessage(
  message: CompanionBridgeMessage,
  terminalConfigs: TerminalConfig[]
): TerminalConfig | null {
  if (message.terminalId) {
    const terminal = terminalConfigs.find((candidate) => candidate.id === message.terminalId)
    if (terminal) return terminal
  }

  if (message.cwd) {
    const cwd = message.cwd
    const terminal = terminalConfigs
      .filter((config) => config.cwd)
      .filter((config) => cwd === config.cwd || cwd.startsWith(`${config.cwd}/`))
      .sort((left, right) => right.cwd.length - left.cwd.length)[0]

    if (terminal) return terminal
  }

  const sessionName = normalizeProjectKey(message.sessionName ?? message.title)
  if (sessionName) {
    const terminal = terminalConfigs.find((config) => {
      const terminalName = normalizeProjectKey(config.name)
      return terminalName && (terminalName === sessionName || sessionName.includes(terminalName))
    })

    if (terminal) return terminal
  }

  return null
}

export function getCompanionMessageColor(
  message: CompanionBridgeMessage,
  projects: Project[],
  terminalConfigs: TerminalConfig[],
  fallbackColor: string
): string {
  const terminal = getTerminalForCompanionMessage(message, terminalConfigs)
  const terminalProject = terminal
    ? (projects.find((candidate) => candidate.id === terminal.projectId) ?? null)
    : null
  const terminalProjectConfigs = terminal
    ? terminalConfigs.filter((config) => config.projectId === terminal.projectId)
    : []
  const project = getProjectForCompanionMessage(message, projects, terminalConfigs)

  return (
    (terminal
      ? getTerminalAccentColor(terminal, terminalProject, terminalProjectConfigs, fallbackColor)
      : null) ??
    normalizeHexColor(message.terminalColor) ??
    project?.color ??
    message.projectColor ??
    fallbackColor
  )
}
