import { app, shell } from 'electron'
import { access } from 'fs/promises'
import { isAbsolute, normalize, resolve } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import type { OpenTargetRequest, OpenTargetResult } from '../shared/system'

const TRAILING_PUNCTUATION_PATTERN = /[.,;:!?)}\]'"]+$/

export function isSafeExternalUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url)
    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:'
  } catch {
    return false
  }
}

function trimPathText(pathText: string): string {
  return pathText
    .trim()
    .replace(/^['"]+|['"]+$/g, '')
    .replace(TRAILING_PUNCTUATION_PATTERN, '')
}

export function expandHomePath(pathText: string): string {
  if (pathText === '~') return app.getPath('home')
  if (pathText.startsWith('~/')) return resolve(app.getPath('home'), pathText.slice(2))
  return pathText
}

export function resolveLocalTarget(pathText: string, cwd?: string): string | null {
  const trimmedPath = trimPathText(pathText)
  if (!trimmedPath || trimmedPath.includes('\0')) return null

  const expandedPath = expandHomePath(trimmedPath)
  const resolvedPath = isAbsolute(expandedPath)
    ? normalize(expandedPath)
    : normalize(resolve(cwd || app.getPath('home'), expandedPath))

  return resolvedPath
}

async function pathExists(pathText: string): Promise<boolean> {
  try {
    await access(pathText)
    return true
  } catch {
    return false
  }
}

async function openWithEditorUrl(
  resolvedTarget: string,
  line?: number,
  column?: number
): Promise<boolean> {
  if (!line) return false

  const defaultAppName = app
    .getApplicationNameForProtocol(pathToFileURL(resolvedTarget).toString())
    .toLowerCase()
  const editorScheme = defaultAppName.includes('cursor')
    ? 'cursor'
    : defaultAppName.includes('visual studio code') || defaultAppName === 'code'
      ? 'vscode'
      : null
  if (!editorScheme) return false

  const filePath = pathToFileURL(resolvedTarget).pathname
  const targetPosition = `${filePath}:${line}:${column ?? 1}`

  try {
    await shell.openExternal(`${editorScheme}://file${targetPosition}`)
    return true
  } catch {
    return false
  }
}

export async function openTarget(request: OpenTargetRequest): Promise<OpenTargetResult> {
  if (request.kind === 'external_url') {
    if (!isSafeExternalUrl(request.url)) return { ok: false, reason: 'unsupported_protocol' }

    try {
      await shell.openExternal(request.url)
      return { ok: true, resolvedTarget: request.url }
    } catch {
      return { ok: false, reason: 'open_failed' }
    }
  }

  if (request.kind === 'file_url') {
    try {
      const parsedUrl = new URL(request.url)
      if (parsedUrl.protocol !== 'file:') return { ok: false, reason: 'unsupported_protocol' }

      const resolvedTarget = normalize(fileURLToPath(parsedUrl))
      if (!(await pathExists(resolvedTarget))) return { ok: false, reason: 'not_found' }

      const errorMessage = await shell.openPath(resolvedTarget)
      if (errorMessage) return { ok: false, reason: 'open_failed' }

      return { ok: true, resolvedTarget }
    } catch {
      return { ok: false, reason: 'invalid_target' }
    }
  }

  const resolvedTarget = resolveLocalTarget(request.path, request.cwd)
  if (!resolvedTarget) return { ok: false, reason: 'invalid_target' }
  if (!(await pathExists(resolvedTarget))) return { ok: false, reason: 'not_found' }

  if (await openWithEditorUrl(resolvedTarget, request.line, request.column)) {
    return { ok: true, resolvedTarget }
  }

  const errorMessage = await shell.openPath(resolvedTarget)
  if (errorMessage) return { ok: false, reason: 'open_failed' }

  return { ok: true, resolvedTarget }
}
