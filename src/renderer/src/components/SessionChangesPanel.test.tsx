import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RunningSession } from '../../../shared/workspace'
import { SessionChangesPanel } from './SessionChangesPanel'

const session: RunningSession = {
  commands: ['codex'],
  configId: 'terminal-1',
  cwd: '/Users/tomasmuniz/dev',
  id: 'session-1',
  kind: 'ai',
  metadata: '/Users/tomasmuniz/dev',
  name: 'Assistant',
  projectColor: '#4ea1ff',
  projectId: 'project-1',
  projectName: 'Pixel',
  startedAt: '2026-05-05T10:00:00.000Z',
  status: 'running'
}

function installApiMock({
  listChangedFiles = vi.fn(() =>
    Promise.resolve({
      ok: true,
      roots: []
    })
  ),
  openTarget = vi.fn()
}: {
  listChangedFiles?: ReturnType<typeof vi.fn>
  openTarget?: ReturnType<typeof vi.fn>
} = {}): {
  listChangedFiles: ReturnType<typeof vi.fn>
  openTarget: ReturnType<typeof vi.fn>
} {
  Object.assign(window, {
    api: {
      system: {
        listChangedFiles,
        openTarget
      }
    }
  })

  return { listChangedFiles, openTarget }
}

describe('SessionChangesPanel', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('requests configured project change roots and renders grouped results', async () => {
    const { listChangedFiles, openTarget } = installApiMock({
      listChangedFiles: vi.fn(() =>
        Promise.resolve({
          ok: true,
          roots: [
            {
              files: [
                {
                  absolutePath: '/repo/backend/src/app.ts',
                  isMarkdown: false,
                  isTest: false,
                  kind: 'modified',
                  path: 'src/app.ts',
                  status: 'M'
                }
              ],
              id: 'backend',
              label: 'Backend',
              ok: true,
              path: '/repo/backend',
              repoRoot: '/repo/backend'
            },
            {
              id: 'missing',
              label: 'Missing repo',
              ok: false,
              path: '/repo/missing',
              reason: 'not_found'
            }
          ]
        })
      )
    })

    render(
      <SessionChangesPanel
        activeProject={{
          changeRoots: [
            { id: 'backend', label: 'Backend', path: '/repo/backend' },
            { id: 'missing', label: 'Missing repo', path: '/repo/missing' }
          ],
          color: '#4ea1ff',
          description: '',
          id: 'project-1',
          name: 'Pixel'
        }}
        codeEditorSettings={{ preferredEditor: 'cursor' }}
        session={session}
        onClose={vi.fn()}
        onOpenMarkdownFile={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(listChangedFiles).toHaveBeenCalledWith({
        cwd: '/Users/tomasmuniz/dev',
        roots: [
          { id: 'backend', label: 'Backend', path: '/repo/backend' },
          { id: 'missing', label: 'Missing repo', path: '/repo/missing' }
        ]
      })
    })

    expect(await screen.findByText('Backend')).toBeInTheDocument()
    expect(screen.getByText('src/app.ts')).toBeInTheDocument()
    expect(screen.getByText('This folder no longer exists.')).toBeInTheDocument()

    fireEvent.click(screen.getByTitle('/repo/backend/src/app.ts'))

    expect(openTarget).toHaveBeenCalledWith({
      editor: 'cursor',
      kind: 'file_path',
      path: '/repo/backend/src/app.ts'
    })
  })

  it('falls back to the terminal cwd when no project roots are configured', async () => {
    const { listChangedFiles } = installApiMock()

    render(
      <SessionChangesPanel
        activeProject={{
          changeRoots: [],
          color: '#4ea1ff',
          description: '',
          id: 'project-1',
          name: 'Pixel'
        }}
        codeEditorSettings={{ preferredEditor: 'auto' }}
        session={session}
        onClose={vi.fn()}
        onOpenMarkdownFile={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(listChangedFiles).toHaveBeenCalledWith({
        cwd: '/Users/tomasmuniz/dev'
      })
    })
  })
})
