export function normalizeWorkspaceFolderPath(raw: string): string {
  let s = raw.trim().replace(/\\/g, '/')
  if (!s) return ''
  while (s.length > 1 && s.endsWith('/')) {
    s = s.slice(0, -1)
  }
  return s
}

export function workspaceDefaultFolderValidationMessage(normalizedPath: string): string | null {
  if (!normalizedPath) return null
  const isAbsolute = normalizedPath.startsWith('/') || /^[A-Za-z]:/.test(normalizedPath)
  if (!isAbsolute) {
    return 'Use an absolute path (for example /home/you/project or C:\\Users\\you\\project).'
  }
  return null
}

/** First candidate that is a non-empty absolute path; used as native folder dialog `defaultPath`. */
export function resolvePickFolderDefaultPath(...candidates: string[]): string | undefined {
  for (const raw of candidates) {
    const normalized = normalizeWorkspaceFolderPath(raw)
    if (!normalized) continue
    if (workspaceDefaultFolderValidationMessage(normalized)) continue
    return normalized
  }
  return undefined
}
