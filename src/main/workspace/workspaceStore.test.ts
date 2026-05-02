import { mkdtemp, rm } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { afterEach, describe, expect, it } from 'vitest'
import type { WorkspaceConfig } from '../../shared/workspace'
import { WorkspaceStore } from './workspaceStore'

let tempDir: string | undefined

async function createWorkspaceStore(): Promise<WorkspaceStore> {
  tempDir = await mkdtemp(join(tmpdir(), 'pixel-workspace-store-'))

  return new WorkspaceStore(() => join(tempDir!, 'workspaces.json'))
}

afterEach(async () => {
  if (!tempDir) return

  await rm(tempDir, { force: true, recursive: true })
  tempDir = undefined
})

describe('WorkspaceStore', () => {
  it('returns null when the workspace config file does not exist', async () => {
    const store = await createWorkspaceStore()

    await expect(store.load()).resolves.toBeNull()
  })

  it('saves and loads workspace config', async () => {
    const store = await createWorkspaceStore()
    const config: WorkspaceConfig = {
      activeProjectId: 'project-1',
      projects: [
        {
          color: '#4ea1ff',
          description: 'Main app',
          id: 'project-1',
          name: 'Pixel Companion'
        }
      ],
      terminalConfigs: [
        {
          commands: ['pnpm dev'],
          cwd: '/tmp/pixel',
          id: 'terminal-1',
          kind: 'dev_server',
          name: 'Dev',
          projectId: 'project-1'
        }
      ],
      terminalThemeId: 'catppuccin_mocha'
    }

    await store.save(config)

    await expect(store.load()).resolves.toEqual(config)
  })
})
