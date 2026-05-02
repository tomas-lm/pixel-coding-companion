import { existsSync } from 'fs'
import { join } from 'path'

const CODEX_START_COMMAND_PATTERN = /^codex(?:\s|$)/
const PIXEL_CODEX_START_COMMAND_PATTERN =
  /^(?:pixel\s+codex|node\s+.+pixel\.mjs['"]?\s+codex)(?:\s|$)/

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

export function wrapCommandWithPixel(
  command: string,
  startWithPixel: boolean | undefined,
  paths: PixelCliCommandPaths
): string {
  const trimmedCommand = command.trim()

  if (!startWithPixel) return trimmedCommand
  if (!CODEX_START_COMMAND_PATTERN.test(trimmedCommand)) return trimmedCommand
  if (PIXEL_CODEX_START_COMMAND_PATTERN.test(trimmedCommand)) return trimmedCommand

  return `${getPixelCliCommand(paths)} ${trimmedCommand}`
}
