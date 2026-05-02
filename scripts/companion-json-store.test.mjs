/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { readJsonFile, writeJsonAtomic } from './companion-json-store.mjs'

let tempDir

async function createFilePath() {
  tempDir = await mkdtemp(path.join(os.tmpdir(), 'pixel-json-store-'))

  return path.join(tempDir, 'nested', 'state.json')
}

afterEach(async () => {
  if (!tempDir) return

  await rm(tempDir, { force: true, recursive: true })
  tempDir = undefined
})

describe('companion-json-store', () => {
  it('writes JSON atomically with a trailing newline', async () => {
    const filePath = await createFilePath()

    await writeJsonAtomic(filePath, { ok: true })

    await expect(readFile(filePath, 'utf8')).resolves.toBe('{\n  "ok": true\n}\n')
  })

  it('reads JSON with fallback and normalization', async () => {
    const filePath = await createFilePath()

    await expect(
      readJsonFile(filePath, {
        fallback: () => ({ ok: false }),
        normalize: (value) => ({ ok: Boolean(value.ok) })
      })
    ).resolves.toEqual({ ok: false })

    await writeJsonAtomic(filePath, { ok: 1 })

    await expect(
      readJsonFile(filePath, {
        fallback: () => ({ ok: false }),
        normalize: (value) => ({ ok: Boolean(value.ok) })
      })
    ).resolves.toEqual({ ok: true })
  })
})
