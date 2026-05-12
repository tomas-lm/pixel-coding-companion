/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  getPixelVaultSkillSourcePath,
  getPixelVaultSkillTargets,
  installPixelVaultBootstrapSkill
} from './pixel-skill-installer.mjs'

let tempDir

async function createRepoWithSkill(skillContents) {
  tempDir = await mkdtemp(path.join(os.tmpdir(), 'pixel-skill-installer-'))
  const repoRoot = path.join(tempDir, 'repo')
  const sourcePath = getPixelVaultSkillSourcePath(repoRoot)
  await mkdir(path.dirname(sourcePath), { recursive: true })
  await writeFile(sourcePath, skillContents, 'utf8')

  return {
    homeDir: path.join(tempDir, 'home'),
    repoRoot,
    sourcePath
  }
}

afterEach(async () => {
  if (!tempDir) return
  await rm(tempDir, { force: true, recursive: true })
  tempDir = undefined
})

describe('pixel skill installer', () => {
  it('installs the canonical skill to Codex and Claude and avoids rewrites', async () => {
    const setup = await createRepoWithSkill('# Pixel Vault Bootstrap\n')
    const first = await installPixelVaultBootstrapSkill(setup)

    expect(first.targets.map((target) => target.status)).toEqual(['installed', 'installed'])

    for (const target of getPixelVaultSkillTargets({ homeDir: setup.homeDir })) {
      await expect(readFile(target.path, 'utf8')).resolves.toBe('# Pixel Vault Bootstrap\n')
    }

    const second = await installPixelVaultBootstrapSkill(setup)
    expect(second.targets.map((target) => target.status)).toEqual(['current', 'current'])
  })

  it('canonical repository skill contains required guidance', async () => {
    const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
    const contents = await readFile(getPixelVaultSkillSourcePath(repoRoot), 'utf8')

    expect(contents).toContain('set up a vault like Tomas uses')
    expect(contents).toContain('<vault>/<area>/<project>/')
    expect(contents).toContain("Do not hard-code Tomas's absolute paths")
  })
})
