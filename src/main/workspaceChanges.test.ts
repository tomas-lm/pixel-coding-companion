import { execFile } from 'child_process'
import { mkdtemp, mkdir, realpath, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { promisify } from 'util'
import { afterEach, describe, expect, it } from 'vitest'
import { listChangedFiles, parseGitStatusPorcelain } from './workspaceChanges'

const execFileAsync = promisify(execFile)

let tempDir: string | undefined

async function createTempDir(): Promise<string> {
  tempDir = await mkdtemp(join(tmpdir(), 'pixel-workspace-changes-'))
  return tempDir
}

async function initGitRepo(path: string): Promise<void> {
  await execFileAsync('git', ['init', path])
}

afterEach(async () => {
  if (!tempDir) return

  await rm(tempDir, { force: true, recursive: true })
  tempDir = undefined
})

describe('parseGitStatusPorcelain', () => {
  it('parses common git status entries', () => {
    const files = parseGitStatusPorcelain(
      [' M src/App.tsx', '?? notes/new.md', 'A  src/App.test.tsx', ''].join('\0'),
      '/repo'
    )

    expect(files).toEqual([
      {
        absolutePath: join('/repo', 'notes/new.md'),
        isMarkdown: true,
        isTest: false,
        kind: 'untracked',
        path: 'notes/new.md',
        status: '??'
      },
      {
        absolutePath: join('/repo', 'src/App.test.tsx'),
        isMarkdown: false,
        isTest: true,
        kind: 'added',
        path: 'src/App.test.tsx',
        status: 'A'
      },
      {
        absolutePath: join('/repo', 'src/App.tsx'),
        isMarkdown: false,
        isTest: false,
        kind: 'modified',
        path: 'src/App.tsx',
        status: 'M'
      }
    ])
  })

  it('keeps rename source paths from porcelain z output', () => {
    const files = parseGitStatusPorcelain(['R  docs/new.md', 'docs/old.md', ''].join('\0'), '/repo')

    expect(files).toEqual([
      {
        absolutePath: join('/repo', 'docs/new.md'),
        isMarkdown: true,
        isTest: false,
        kind: 'renamed',
        oldPath: 'docs/old.md',
        path: 'docs/new.md',
        status: 'R'
      }
    ])
  })

  it('returns grouped changes for multiple configured roots', async () => {
    const root = await createTempDir()
    const repoA = join(root, 'repo-a')
    const repoB = join(root, 'repo-b')
    const missingRepo = join(root, 'missing')
    const nonGitFolder = join(root, 'non-git')

    await initGitRepo(repoA)
    await initGitRepo(repoB)
    await mkdir(nonGitFolder)
    await writeFile(join(repoA, 'note.md'), '# Note')
    const repoARealPath = await realpath(repoA)
    const repoBRealPath = await realpath(repoB)

    await expect(
      listChangedFiles({
        roots: [
          { id: 'repo-a', label: 'Repo A', path: repoA },
          { id: 'repo-b', label: 'Repo B', path: repoB },
          { id: 'missing', label: 'Missing', path: missingRepo },
          { id: 'non-git', label: 'Non Git', path: nonGitFolder }
        ]
      })
    ).resolves.toEqual({
      ok: true,
      roots: [
        {
          files: [
            {
              absolutePath: join(repoARealPath, 'note.md'),
              isMarkdown: true,
              isTest: false,
              kind: 'untracked',
              oldPath: undefined,
              path: 'note.md',
              status: '??'
            }
          ],
          id: 'repo-a',
          label: 'Repo A',
          ok: true,
          path: repoA,
          repoRoot: repoARealPath
        },
        {
          files: [],
          id: 'repo-b',
          label: 'Repo B',
          ok: true,
          path: repoB,
          repoRoot: repoBRealPath
        },
        {
          id: 'missing',
          label: 'Missing',
          ok: false,
          path: missingRepo,
          reason: 'not_found'
        },
        {
          id: 'non-git',
          label: 'Non Git',
          ok: false,
          path: nonGitFolder,
          reason: 'not_git_repo'
        }
      ]
    })
  })

  it('falls back to the terminal cwd when no roots are configured', async () => {
    const repo = await createTempDir()
    await initGitRepo(repo)
    await writeFile(join(repo, 'src.ts'), 'export const value = 1')
    const repoRealPath = await realpath(repo)

    await expect(listChangedFiles({ cwd: repo })).resolves.toMatchObject({
      ok: true,
      roots: [
        {
          files: [
            {
              kind: 'untracked',
              path: 'src.ts'
            }
          ],
          id: 'cwd',
          ok: true,
          path: repo,
          repoRoot: repoRealPath
        }
      ]
    })
  })
})
