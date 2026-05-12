/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

export const PIXEL_VAULT_SKILL_RELATIVE_PATH = path.join(
  'resources',
  'skills',
  'pixel-vault-bootstrap',
  'SKILL.md'
)

export function getPixelVaultSkillSourcePath(repoRoot) {
  return path.join(repoRoot, PIXEL_VAULT_SKILL_RELATIVE_PATH)
}

export function getPixelVaultSkillTargets({ homeDir = os.homedir() } = {}) {
  return [
    {
      agent: 'codex',
      path: path.join(homeDir, '.codex', 'skills', 'pixel-vault-bootstrap', 'SKILL.md')
    },
    {
      agent: 'claude',
      path: path.join(homeDir, '.claude', 'skills', 'pixel-vault-bootstrap', 'SKILL.md')
    }
  ]
}

async function readIfExists(filePath) {
  try {
    return await readFile(filePath, 'utf8')
  } catch (error) {
    if (error?.code === 'ENOENT') return null
    throw error
  }
}

async function writeIfChanged(filePath, contents) {
  const current = await readIfExists(filePath)
  if (current === contents) return 'current'

  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, contents, 'utf8')

  return current === null ? 'installed' : 'updated'
}

export async function installPixelVaultBootstrapSkill({ homeDir = os.homedir(), repoRoot } = {}) {
  if (!repoRoot) throw new Error('repoRoot is required to install Pixel skills')

  const sourcePath = getPixelVaultSkillSourcePath(repoRoot)
  const source = await readFile(sourcePath, 'utf8')
  const targets = getPixelVaultSkillTargets({ homeDir })
  const results = []

  for (const target of targets) {
    results.push({
      ...target,
      status: await writeIfChanged(target.path, source)
    })
  }

  return {
    sourcePath,
    targets: results
  }
}
