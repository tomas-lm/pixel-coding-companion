import { mkdtemp, rm, writeFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { afterEach, describe, expect, it } from 'vitest'
import { CompanionBridgeStore, normalizeCompanionBridgeState } from './companionBridgeStore'

let tempDir: string | undefined

async function createBridgeStore(): Promise<CompanionBridgeStore> {
  tempDir = await mkdtemp(join(tmpdir(), 'pixel-companion-bridge-'))

  return new CompanionBridgeStore(() => join(tempDir!, 'companion-state.json'))
}

afterEach(async () => {
  if (!tempDir) return

  await rm(tempDir, { force: true, recursive: true })
  tempDir = undefined
})

describe('CompanionBridgeStore', () => {
  it('returns the default bridge state when the file does not exist', async () => {
    const store = await createBridgeStore()

    await expect(store.load()).resolves.toEqual({
      currentState: 'idle',
      messages: []
    })
  })

  it('normalizes bridge messages and caps history', () => {
    const messages = Array.from({ length: 90 }, (_, index) => ({
      id: `message-${index}`,
      createdAt: '2026-05-02T10:00:00.000Z',
      title: `Message ${index}`,
      summary: 'Done',
      cliState: 'done',
      source: 'mcp'
    }))

    const state = normalizeCompanionBridgeState({
      currentState: 'working',
      messages: [...messages, { id: 'bad-message' }],
      updatedAt: '2026-05-02T11:00:00.000Z'
    })

    expect(state.currentState).toBe('working')
    expect(state.messages).toHaveLength(80)
    expect(state.messages[0].id).toBe('message-10')
    expect(state.messages.at(-1)?.id).toBe('message-89')
  })

  it('loads normalized bridge state from disk', async () => {
    const store = await createBridgeStore()
    await writeFile(
      join(tempDir!, 'companion-state.json'),
      JSON.stringify({
        currentState: 'error',
        messages: [
          {
            id: 'message-1',
            createdAt: '2026-05-02T10:00:00.000Z',
            title: 'Failed',
            summary: 'Something failed',
            cliState: 'error',
            source: 'mcp'
          }
        ]
      }),
      'utf8'
    )

    await expect(store.load()).resolves.toMatchObject({
      currentState: 'error',
      messages: [{ id: 'message-1' }]
    })
  })
})
