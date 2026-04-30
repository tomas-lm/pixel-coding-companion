import type { OpenTargetRequest } from '../../../shared/system'

const MAX_LINE_LENGTH = 2000
const MAX_LINKS_PER_LINE = 10

const URL_PATTERN = /\bhttps?:\/\/[^\s<>"'`]+/g
const TRAILING_URL_PUNCTUATION_PATTERN = /[.,!?)}\]'"]+$/
const TRAILING_PATH_PUNCTUATION_PATTERN = /[.,;:!?)}\]'"]+$/
const NUMERIC_VERSION_PATTERN = /^\d+(?:\.\d+)+$/

const EXCLUDED_PATH_CHARS = String.raw`[^\0<>\?\s!` + '`' + String.raw`&*()'":;\\]`
const EXCLUDED_START_PATH_CHARS = String.raw`[^\0<>\?\s!` + '`' + String.raw`&*()\[\]'":;\\]`
const EXCLUDED_STANDALONE_CHARS = String.raw`[^\0<>\?\s!` + '`' + String.raw`&*()'":;\\/]`
const EXCLUDED_START_STANDALONE_CHARS = String.raw`[^\0<>\?\s!` + '`' + String.raw`&*()\[\]'":;\\/]`

const PATH_WITH_SEPARATOR_CLAUSE = `(?:(?:\\.\\.?|~)|(?:${EXCLUDED_START_PATH_CHARS}${EXCLUDED_PATH_CHARS}*))?(?:[\\\\/](?:${EXCLUDED_PATH_CHARS})+)+`
const STANDALONE_DOTTED_FILENAME_CLAUSE =
  `(?:${EXCLUDED_START_STANDALONE_CHARS}${EXCLUDED_STANDALONE_CHARS}*\\.[^\\0<>\\?\\s!` +
  '`' +
  `&*()'":;\\\\/.]+${EXCLUDED_STANDALONE_CHARS}*)`
const EXPLICIT_DOTFILE_CLAUSE = String.raw`(?:\.(?:env|gitignore|npmrc|yarnrc|editorconfig))`
const PATH_CLAUSE = `(?<path>(?:${PATH_WITH_SEPARATOR_CLAUSE})|(?:${STANDALONE_DOTTED_FILENAME_CLAUSE})|(?:${EXPLICIT_DOTFILE_CLAUSE}))`

const PATH_REGEX = new RegExp(PATH_CLAUSE, 'g')
const PATH_BEFORE_SUFFIX_REGEX = new RegExp(`${PATH_CLAUSE}$`)
const LINK_SUFFIX_REGEX =
  /(?::(?<line>\d+)(?::(?<column>\d+))?|\((?<parenLine>\d+),\s*(?<parenColumn>\d+)\))/g
const PREFIXED_PATH_WITH_SPACES_PATTERN = /(?:^|[\s([{])((?:~\/|\.{1,2}\/|\/)[^\t\n<>|;`]+)/g

export type TerminalLinkCandidate = {
  request: OpenTargetRequest
  startIndex: number
  endIndex: number
  text: string
}

type LocalPathCandidate = {
  startIndex: number
  endIndex: number
  pathText: string
  line?: number
  column?: number
}

function trimUrlText(text: string): string {
  return text.trim().replace(TRAILING_URL_PUNCTUATION_PATTERN, '')
}

function trimPathText(text: string): string {
  return text.trim().replace(TRAILING_PATH_PUNCTUATION_PATTERN, '')
}

function trimPathWithSpaces(text: string): string {
  return trimPathText(text.split(/\s{2,}/)[0])
}

function isNumericVersion(pathText: string): boolean {
  return (
    !pathText.includes('/') && !pathText.includes('\\') && NUMERIC_VERSION_PATTERN.test(pathText)
  )
}

function isValidLocalPath(pathText: string): boolean {
  if (!pathText || pathText.length < 3) return false
  if (pathText.includes('://')) return false
  if (isNumericVersion(pathText)) return false

  return true
}

function withCwd(request: OpenTargetRequest, cwd?: string): OpenTargetRequest {
  if (request.kind !== 'file_path' || !cwd) return request
  return { ...request, cwd }
}

function rangesOverlap(
  leftStartIndex: number,
  leftEndIndex: number,
  rightStartIndex: number,
  rightEndIndex: number
): boolean {
  return leftStartIndex < rightEndIndex && rightStartIndex < leftEndIndex
}

function candidateOverlaps(
  candidate: { startIndex: number; endIndex: number },
  links: TerminalLinkCandidate[]
): boolean {
  return links.some((link) =>
    rangesOverlap(candidate.startIndex, candidate.endIndex, link.startIndex, link.endIndex)
  )
}

function addLink(links: TerminalLinkCandidate[], link: TerminalLinkCandidate): void {
  if (links.length >= MAX_LINKS_PER_LINE) return
  if (candidateOverlaps(link, links)) return

  links.push(link)
}

function toFileLink(candidate: LocalPathCandidate, cwd?: string): TerminalLinkCandidate {
  const request = withCwd(
    {
      kind: 'file_path',
      path: candidate.pathText,
      ...(candidate.line ? { line: candidate.line } : {}),
      ...(candidate.column ? { column: candidate.column } : {})
    },
    cwd
  )

  return {
    request,
    startIndex: candidate.startIndex,
    endIndex: candidate.endIndex,
    text: candidate.pathText
  }
}

function findUrlLinks(line: string): TerminalLinkCandidate[] {
  const links: TerminalLinkCandidate[] = []

  for (const match of line.matchAll(URL_PATTERN)) {
    if (match.index === undefined) continue

    const url = trimUrlText(match[0])
    if (!url) continue

    addLink(links, {
      request: { kind: 'external_url', url },
      startIndex: match.index,
      endIndex: match.index + url.length,
      text: url
    })
  }

  return links
}

function findSuffixPathCandidates(line: string): LocalPathCandidate[] {
  const candidates: LocalPathCandidate[] = []
  const suffixRegex = new RegExp(LINK_SUFFIX_REGEX.source, LINK_SUFFIX_REGEX.flags)

  for (const match of line.matchAll(suffixRegex)) {
    const suffixStartIndex = match.index
    if (suffixStartIndex === undefined) continue

    const beforeSuffix = line.slice(0, suffixStartIndex)
    const pathMatch = beforeSuffix.match(PATH_BEFORE_SUFFIX_REGEX)
    const pathText = pathMatch?.groups?.path
    if (!pathText) continue

    const trimmedPathText = trimPathText(pathText)
    if (!isValidLocalPath(trimmedPathText)) continue

    const lineText = match.groups?.line ?? match.groups?.parenLine
    const columnText = match.groups?.column ?? match.groups?.parenColumn
    const startIndex = suffixStartIndex - pathText.length

    candidates.push({
      startIndex,
      endIndex: startIndex + trimmedPathText.length + match[0].length,
      pathText: trimmedPathText,
      line: lineText ? Number(lineText) : undefined,
      column: columnText ? Number(columnText) : undefined
    })
  }

  return candidates
}

function findPathOnlyCandidates(
  line: string,
  existingLinks: TerminalLinkCandidate[]
): LocalPathCandidate[] {
  const candidates: LocalPathCandidate[] = []
  const pathRegex = new RegExp(PATH_REGEX.source, PATH_REGEX.flags)

  for (const match of line.matchAll(pathRegex)) {
    const startIndex = match.index
    const pathText = match.groups?.path
    if (startIndex === undefined || !pathText) continue

    const trimmedPathText = trimPathText(pathText)
    if (!isValidLocalPath(trimmedPathText)) continue

    const candidate = {
      startIndex,
      endIndex: startIndex + trimmedPathText.length,
      pathText: trimmedPathText
    }

    if (candidateOverlaps(candidate, existingLinks)) continue
    candidates.push(candidate)
  }

  for (const match of line.matchAll(PREFIXED_PATH_WITH_SPACES_PATTERN)) {
    if (match.index === undefined || !match[1]) continue

    const candidateStartIndex = match.index + match[0].lastIndexOf(match[1])
    const pathText = trimPathWithSpaces(match[1])
    if (!isValidLocalPath(pathText)) continue

    const candidate = {
      startIndex: candidateStartIndex,
      endIndex: candidateStartIndex + pathText.length,
      pathText
    }

    if (candidateOverlaps(candidate, existingLinks)) continue
    if (
      candidates.some((currentCandidate) =>
        rangesOverlap(
          candidate.startIndex,
          candidate.endIndex,
          currentCandidate.startIndex,
          currentCandidate.endIndex
        )
      )
    ) {
      continue
    }

    candidates.push(candidate)
  }

  return candidates
}

export function findTerminalLinks(line: string, cwd?: string): TerminalLinkCandidate[] {
  if (!line.trim() || line.length > MAX_LINE_LENGTH) return []

  const links = findUrlLinks(line)

  for (const candidate of findSuffixPathCandidates(line)) {
    addLink(links, toFileLink(candidate, cwd))
  }

  for (const candidate of findPathOnlyCandidates(line, links)) {
    addLink(links, toFileLink(candidate, cwd))
  }

  return links.sort((left, right) => left.startIndex - right.startIndex)
}
