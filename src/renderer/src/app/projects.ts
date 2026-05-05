import type { Project, ProjectChangeRoot } from '../../../shared/workspace'

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

export function normalizeProjectChangeRoots(value: unknown): ProjectChangeRoot[] {
  if (!Array.isArray(value)) return []

  const seenPaths = new Set<string>()
  const roots: ProjectChangeRoot[] = []

  value.forEach((rawRoot, index) => {
    if (!isPlainObject(rawRoot)) return

    const rawPath = rawRoot.path
    if (typeof rawPath !== 'string') return

    const path = rawPath.trim()
    if (!path || path.includes('\0') || seenPaths.has(path)) return

    seenPaths.add(path)

    const rawId = rawRoot.id
    const rawLabel = rawRoot.label
    const label = typeof rawLabel === 'string' ? rawLabel.trim() : ''

    roots.push({
      id: typeof rawId === 'string' && rawId.trim() ? rawId.trim() : `change-root-${index}`,
      path,
      ...(label ? { label } : {})
    })
  })

  return roots
}

export function normalizeProjects(value: unknown): Project[] {
  if (!Array.isArray(value)) return []

  return value
    .filter((project): project is Project => isPlainObject(project))
    .map((project) => ({
      ...project,
      changeRoots: normalizeProjectChangeRoots(project.changeRoots)
    }))
}
