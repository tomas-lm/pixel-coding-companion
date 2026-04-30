import type { OpenTargetRequest } from '../../../shared/system'

function isPathLikeLink(text: string): boolean {
  return (
    text.startsWith('/') || text.startsWith('~/') || text.startsWith('./') || text.startsWith('../')
  )
}

export function getOpenTargetRequestFromHyperlink(
  text: string,
  cwd?: string
): OpenTargetRequest | null {
  const linkText = text.trim()
  if (!linkText) return null

  try {
    const url = new URL(linkText)
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return { kind: 'external_url', url: linkText }
    }

    if (url.protocol === 'file:') {
      return { kind: 'file_url', url: linkText }
    }

    return null
  } catch {
    if (!isPathLikeLink(linkText)) return null
    return { kind: 'file_path', path: linkText, cwd }
  }
}
