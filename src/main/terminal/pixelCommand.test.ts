import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { afterEach, describe, expect, it } from 'vitest'
import {
  detectPixelLauncherAgent,
  getPixelCliCommand,
  resolvePixelLauncherAgent,
  shellQuote,
  wrapCommandWithPixel,
  type PixelCliCommandPaths
} from './pixelCommand'

let tempDir: string | undefined

async function createPaths(): Promise<PixelCliCommandPaths> {
  tempDir = await mkdtemp(join(tmpdir(), 'pixel-command-'))

  return {
    appPath: join(tempDir, 'app'),
    cwd: join(tempDir, 'cwd'),
    resourcesPath: join(tempDir, 'resources')
  }
}

afterEach(async () => {
  if (!tempDir) return

  await rm(tempDir, { force: true, recursive: true })
  tempDir = undefined
})

describe('pixelCommand', () => {
  it('quotes shell paths safely', () => {
    expect(shellQuote("/tmp/Tomas' App/pixel.mjs")).toBe("'/tmp/Tomas'\\'' App/pixel.mjs'")
  })

  it('falls back to pixel when no local script exists', async () => {
    const paths = await createPaths()

    expect(getPixelCliCommand(paths)).toBe('pixel')
  })

  it('prefers the repo pixel script when it exists', async () => {
    const paths = await createPaths()
    const scriptPath = join(paths.cwd, 'scripts', 'pixel.mjs')
    await mkdir(join(paths.cwd, 'scripts'), { recursive: true })
    await writeFile(scriptPath, '', 'utf8')

    expect(getPixelCliCommand(paths)).toBe(`node ${shellQuote(scriptPath)}`)
  })

  it('wraps plain codex commands when Codex is selected', async () => {
    const paths = await createPaths()

    expect(wrapCommandWithPixel('codex --help', true, 'codex', paths)).toBe('pixel codex --help')
    expect(wrapCommandWithPixel('codex --help', false, 'codex', paths)).toBe('codex --help')
    expect(wrapCommandWithPixel('pnpm dev', true, 'codex', paths)).toBe('pnpm dev')
    expect(wrapCommandWithPixel('pixel codex --help', true, 'codex', paths)).toBe(
      'pixel codex --help'
    )
  })

  it('wraps plain claude commands when Claude is selected', async () => {
    const paths = await createPaths()

    expect(wrapCommandWithPixel('claude --help', true, 'claude', paths)).toBe('pixel claude --help')
    expect(wrapCommandWithPixel('codex --help', true, 'claude', paths)).toBe('codex --help')
    expect(wrapCommandWithPixel('pixel claude --help', true, 'claude', paths)).toBe(
      'pixel claude --help'
    )
  })

  it('detects launcher agent commands', () => {
    expect(detectPixelLauncherAgent('claude --dangerously-skip-permissions')).toBe('claude')
    expect(detectPixelLauncherAgent('pixel claude --resume')).toBe('claude')
    expect(detectPixelLauncherAgent('codex --model gpt-5.5')).toBe('codex')
    expect(detectPixelLauncherAgent('pixel codex --model gpt-5.5')).toBe('codex')
    expect(detectPixelLauncherAgent('pnpm dev')).toBeNull()
  })

  it('auto-detects the command agent and falls back to Claude', async () => {
    const paths = await createPaths()

    expect(resolvePixelLauncherAgent('pnpm dev', 'auto')).toBe('claude')
    expect(wrapCommandWithPixel('claude --help', true, 'auto', paths)).toBe('pixel claude --help')
    expect(wrapCommandWithPixel('codex --help', true, 'auto', paths)).toBe('pixel codex --help')
    expect(wrapCommandWithPixel('pnpm dev', true, 'auto', paths)).toBe('pnpm dev')
    expect(wrapCommandWithPixel('codex --help', true, undefined, paths)).toBe('pixel codex --help')
  })
})
