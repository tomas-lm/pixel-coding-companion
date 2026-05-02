/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  getDefaultEventType,
  normalizeMessage,
  normalizeState,
  readBridgeState,
  writeBridgeMessage
} from './companion-bridge-state.mjs'

let tempDir

async function createPaths() {
  tempDir = await mkdtemp(path.join(os.tmpdir(), 'pixel-bridge-state-'))

  return {
    dataDir: tempDir,
    eventsPath: path.join(tempDir, 'companion-events.jsonl'),
    statePath: path.join(tempDir, 'companion-state.json')
  }
}

afterEach(async () => {
  if (!tempDir) return

  await rm(tempDir, { force: true, recursive: true })
  tempDir = undefined
})

describe('companion-bridge-state', () => {
  it('derives event types from cli state', () => {
    expect(getDefaultEventType('working')).toBe('started')
    expect(getDefaultEventType('done')).toBe('finished')
    expect(getDefaultEventType('waiting_input')).toBe('needs_input')
    expect(getDefaultEventType('idle')).toBe('note')
  })

  it('normalizes messages with companion defaults', () => {
    expect(
      normalizeMessage(
        {
          id: 'message-1',
          createdAt: '2026-05-02T10:00:00.000Z',
          cliState: 'done',
          source: 'app',
          summary: 'Finished',
          title: 'Done'
        },
        { companionId: 'frogo', companionName: 'Frogo' }
      )
    ).toMatchObject({
      cliState: 'done',
      companionId: 'frogo',
      companionName: 'Frogo',
      eventType: 'finished',
      source: 'app'
    })
  })

  it('normalizes state and caps message history', () => {
    const messages = Array.from({ length: 90 }, (_, index) => ({
      id: `message-${index}`,
      createdAt: '2026-05-02T10:00:00.000Z',
      cliState: 'done',
      summary: 'Done',
      title: 'Done'
    }))

    const state = normalizeState(
      {
        currentState: 'working',
        messages
      },
      { companionId: 'ghou', companionName: 'Ghou' }
    )

    expect(state.currentState).toBe('working')
    expect(state.messages).toHaveLength(80)
    expect(state.messages[0].id).toBe('message-10')
  })

  it('can fall back on invalid bridge JSON when requested', async () => {
    const { statePath } = await createPaths()
    await writeFile(statePath, '{bad json', 'utf8')

    await expect(readBridgeState(statePath, { swallowSyntax: true })).resolves.toEqual({
      currentState: 'idle',
      messages: []
    })
  })

  it('writes state and appends the event log', async () => {
    const paths = await createPaths()
    const message = {
      id: 'message-1',
      cliState: 'done',
      createdAt: '2026-05-02T10:00:00.000Z',
      summary: 'Finished',
      title: 'Done'
    }

    await writeBridgeMessage({
      ...paths,
      message,
      stateOptions: { companionId: 'raya', companionName: 'Raya' }
    })

    await expect(readBridgeState(paths.statePath)).resolves.toMatchObject({
      currentState: 'done',
      messages: [{ id: 'message-1' }]
    })
    await expect(readFile(paths.eventsPath, 'utf8')).resolves.toBe(`${JSON.stringify(message)}\n`)
  })
})
