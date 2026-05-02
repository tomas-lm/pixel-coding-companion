/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'

export async function readJsonFile(filePath, { fallback, normalize, swallowSyntax = false } = {}) {
  try {
    const file = await readFile(filePath, 'utf8')
    const value = JSON.parse(file)

    return normalize ? normalize(value) : value
  } catch (error) {
    if (error && error.code === 'ENOENT')
      return typeof fallback === 'function' ? fallback() : fallback
    if (swallowSyntax && error instanceof SyntaxError) {
      return typeof fallback === 'function' ? fallback() : fallback
    }
    throw error
  }
}

export async function writeJsonAtomic(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true })
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`

  await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  await rename(tempPath, filePath)
}
