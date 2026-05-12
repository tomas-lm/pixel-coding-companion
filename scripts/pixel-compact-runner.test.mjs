/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { formatCompactLog, readCompactLog } from './pixel-compact-logs.mjs'
import { runCompactCommand, summarizeCommandOutput } from './pixel-compact-runner.mjs'

let tempDir

async function createTempDir() {
  tempDir = await mkdtemp(path.join(os.tmpdir(), 'pixel-compact-runner-'))
  return tempDir
}

afterEach(async () => {
  if (!tempDir) return
  await rm(tempDir, { force: true, recursive: true })
  tempDir = undefined
})

describe('pixel compact runner', () => {
  it('stores raw output and preserves a passing exit code', async () => {
    const dataDir = await createTempDir()
    const result = await runCompactCommand(
      ['node', '-e', 'console.log(process.cwd()); console.log(process.env.PIXEL_TEST_FLAG)'],
      {
        cwd: dataDir,
        dataDir,
        env: {
          ...process.env,
          PIXEL_TEST_FLAG: 'present'
        }
      }
    )

    expect(result.exitCode).toBe(0)
    expect(result.rawOutputId).toMatch(/^pxout_/)
    expect(result.summary).toContain('Raw output:')

    const log = await readCompactLog(result.rawOutputId, { dataDir })
    expect(log.cwd).toBe(dataDir)
    expect(log.stdout).toContain(dataDir)
    expect(log.stdout).toContain('present')
    expect(formatCompactLog(log)).toContain('--- stdout ---')
  })

  it('stores raw output and preserves a failing exit code', async () => {
    const dataDir = await createTempDir()
    const result = await runCompactCommand(
      ['node', '-e', 'console.error("assert failed at example.test.ts:4"); process.exit(7)'],
      {
        dataDir
      }
    )

    expect(result.exitCode).toBe(7)
    expect(result.summary).toContain('Exit code: 7')
    expect(result.summary).toContain('assert failed')
  })

  it('preserves leading environment assignments in rerun commands', async () => {
    const dataDir = await createTempDir()
    const result = await runCompactCommand(
      ['PIXEL_COMPACT_ENV=kept', 'node', '-e', 'console.log(process.env.PIXEL_COMPACT_ENV)'],
      { dataDir }
    )

    expect(result.exitCode).toBe(0)

    const log = await readCompactLog(result.rawOutputId, { dataDir })
    expect(log.stdout.trim()).toBe('kept')
    expect(log.commandPath).toBe('node')
  })

  it('creates focused summaries for git and listings', () => {
    expect(
      summarizeCommandOutput({
        command: 'git diff',
        durationMs: 1,
        exitCode: 0,
        rawOutputId: 'pxout_20260512000000_abcdef1234',
        stderr: '',
        stdout: 'diff --git a/src/a.ts b/src/a.ts\n'
      })
    ).toContain('Changed files detected: 1')

    expect(
      summarizeCommandOutput({
        command: 'find . -type f',
        durationMs: 1,
        exitCode: 0,
        rawOutputId: 'pxout_20260512000000_abcdef1234',
        stderr: '',
        stdout: 'src/a.ts\nsrc/b.ts\ntests/a.test.ts\n'
      })
    ).toContain('Top groups:')
  })
})
