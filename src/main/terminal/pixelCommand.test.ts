import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { afterEach, describe, expect, it } from 'vitest'
import {
  getPixelCliCommand,
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

  it('wraps plain codex commands only when requested', async () => {
    const paths = await createPaths()

    expect(wrapCommandWithPixel('codex --help', true, paths)).toBe('pixel codex --help')
    expect(wrapCommandWithPixel('codex --help', false, paths)).toBe('codex --help')
    expect(wrapCommandWithPixel('pnpm dev', true, paths)).toBe('pnpm dev')
    expect(wrapCommandWithPixel('pixel codex --help', true, paths)).toBe('pixel codex --help')
  })
})
