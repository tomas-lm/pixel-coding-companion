import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { parseGitStatusPorcelain } from './workspaceChanges'

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
})
