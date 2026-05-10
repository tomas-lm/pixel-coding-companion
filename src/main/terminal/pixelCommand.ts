import { existsSync } from 'fs'
import { join } from 'path'
import {
  DEFAULT_PIXEL_LAUNCHER_FALLBACK_AGENT_ID,
  type PixelLauncherAgentId,
  type ResolvedPixelLauncherAgentId
} from '../../shared/workspace'

const CODEX_START_COMMAND_PATTERN = /^codex(?:\s|$)/
const PIXEL_CODEX_START_COMMAND_PATTERN =
  /^(?:pixel\s+codex|node\s+.+pixel\.mjs['"]?\s+codex)(?:\s|$)/
const CLAUDE_START_COMMAND_PATTERN = /^claude(?:\s|$)/
const PIXEL_CLAUDE_START_COMMAND_PATTERN =
  /^(?:pixel\s+claude|node\s+.+pixel\.mjs['"]?\s+claude)(?:\s|$)/

export type PixelCliCommandPaths = {
  appPath: string
  cwd: string
  resourcesPath: string
}

export function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`
}

export function getPixelCliCommand(paths: PixelCliCommandPaths): string {
  const candidates = [
    join(paths.cwd, 'scripts', 'pixel.mjs'),
    join(paths.resourcesPath, 'app.asar.unpacked', 'scripts', 'pixel.mjs'),
    join(paths.appPath, 'scripts', 'pixel.mjs')
  ]
  const scriptPath = candidates.find((candidate) => existsSync(candidate))

  return scriptPath ? `node ${shellQuote(scriptPath)}` : 'pixel'
}

export function detectPixelLauncherAgent(command: string): ResolvedPixelLauncherAgentId | null {
  const trimmedCommand = command.trim()

  if (
    CLAUDE_START_COMMAND_PATTERN.test(trimmedCommand) ||
    PIXEL_CLAUDE_START_COMMAND_PATTERN.test(trimmedCommand)
  ) {
    return 'claude'
  }

  if (
    CODEX_START_COMMAND_PATTERN.test(trimmedCommand) ||
    PIXEL_CODEX_START_COMMAND_PATTERN.test(trimmedCommand)
  ) {
    return 'codex'
  }

  return null
}

export function resolvePixelLauncherAgent(
  command: string,
  pixelAgent: PixelLauncherAgentId | undefined
): ResolvedPixelLauncherAgentId {
  if (pixelAgent && pixelAgent !== 'auto') return pixelAgent

  return detectPixelLauncherAgent(command) ?? DEFAULT_PIXEL_LAUNCHER_FALLBACK_AGENT_ID
}

export function wrapCommandWithPixel(
  command: string,
  startWithPixel: boolean | undefined,
  pixelAgent: PixelLauncherAgentId | undefined,
  paths: PixelCliCommandPaths
): string {
  const trimmedCommand = command.trim()

  if (!startWithPixel) return trimmedCommand
  const selectedAgent = resolvePixelLauncherAgent(trimmedCommand, pixelAgent)

  if (selectedAgent === 'codex') {
    if (!CODEX_START_COMMAND_PATTERN.test(trimmedCommand)) return trimmedCommand
    if (PIXEL_CODEX_START_COMMAND_PATTERN.test(trimmedCommand)) return trimmedCommand

    return `${getPixelCliCommand(paths)} ${trimmedCommand}`
  }

  if (!CLAUDE_START_COMMAND_PATTERN.test(trimmedCommand)) return trimmedCommand
  if (PIXEL_CLAUDE_START_COMMAND_PATTERN.test(trimmedCommand)) return trimmedCommand

  return `${getPixelCliCommand(paths)} ${trimmedCommand}`
}
