import { execFile } from 'child_process'
import { access } from 'fs/promises'
import { join, normalize } from 'path'
import { promisify } from 'util'
import type {
  WorkspaceChangedFile,
  WorkspaceChangesRequest,
  WorkspaceChangesResult,
  WorkspaceChangeKind
} from '../shared/system'

const execFileAsync = promisify(execFile)

const MARKDOWN_FILE_PATTERN = /\.(?:md|markdown)$/i
const TEST_FILE_PATTERN = /(^|[\\/])(?:__tests__|tests?)(?:[\\/]|$)|\.(?:test|spec)\.[^\\/]+$/i

function toChangeKind(status: string): WorkspaceChangeKind {
  if (status === '??') return 'untracked'
  if (status.includes('U') || status === 'AA' || status === 'DD') return 'conflicted'
  if (status.includes('R')) return 'renamed'
  if (status.includes('C')) return 'copied'
  if (status.includes('A')) return 'added'
  if (status.includes('D')) return 'deleted'

  return 'modified'
}

function toStatusLabel(status: string): string {
  if (status === '??') return status

  return status.trim() || status
}

function isMarkdownFile(pathText: string): boolean {
  return MARKDOWN_FILE_PATTERN.test(pathText)
}

function isTestFile(pathText: string): boolean {
  return TEST_FILE_PATTERN.test(pathText)
}

export function parseGitStatusPorcelain(
  porcelainOutput: string,
  repoRoot: string
): WorkspaceChangedFile[] {
  const records = porcelainOutput.split('\0')
  const files: WorkspaceChangedFile[] = []

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index]
    if (!record) continue

    const status = record.slice(0, 2)
    const path = record.slice(3)
    if (!path) continue

    let oldPath: string | undefined
    if (status.includes('R') || status.includes('C')) {
      oldPath = records[index + 1] || undefined
      index += 1
    }

    files.push({
      absolutePath: normalize(join(repoRoot, path)),
      isMarkdown: isMarkdownFile(path),
      isTest: isTestFile(path),
      kind: toChangeKind(status),
      oldPath,
      path,
      status: toStatusLabel(status)
    })
  }

  return files.sort((left, right) => left.path.localeCompare(right.path))
}

async function runGit(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', ['-C', cwd, ...args], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 8
  })

  return stdout
}

export async function listChangedFiles(
  request: WorkspaceChangesRequest
): Promise<WorkspaceChangesResult> {
  const cwd = request.cwd?.trim()
  if (!cwd || cwd.includes('\0')) return { ok: false, reason: 'invalid_target' }

  try {
    await access(cwd)
  } catch {
    return { ok: false, reason: 'not_found' }
  }

  let repoRoot: string
  try {
    repoRoot = (await runGit(cwd, ['rev-parse', '--show-toplevel'])).trim()
  } catch {
    return { ok: false, reason: 'not_git_repo' }
  }

  try {
    const porcelainOutput = await runGit(repoRoot, [
      'status',
      '--porcelain=v1',
      '-z',
      '--untracked-files=all'
    ])

    return {
      ok: true,
      files: parseGitStatusPorcelain(porcelainOutput, repoRoot),
      repoRoot
    }
  } catch {
    return { ok: false, reason: 'open_failed' }
  }
}
