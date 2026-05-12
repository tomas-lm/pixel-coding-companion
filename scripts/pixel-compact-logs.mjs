/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { getDefaultDataDir } from './companion-data-dir.mjs'

export function getCompactLogsDir(dataDir = getDefaultDataDir()) {
  return path.join(dataDir, 'compact-output')
}

export function createCompactOutputId({ command, cwd, endedAt, stdout, stderr }) {
  const timestamp = new Date(endedAt)
    .toISOString()
    .replace(/[-:.TZ]/g, '')
    .slice(0, 14)
  const hash = createHash('sha256')
    .update(JSON.stringify({ command, cwd, endedAt, stdout, stderr }))
    .digest('hex')
    .slice(0, 10)

  return `pxout_${timestamp}_${hash}`
}

export function getCompactLogPath(id, dataDir = getDefaultDataDir()) {
  if (!/^pxout_[0-9]{14}_[a-f0-9]{10}$/.test(id)) {
    throw new Error(`Invalid Pixel compact output id: ${id}`)
  }

  return path.join(getCompactLogsDir(dataDir), `${id}.json`)
}

export async function writeCompactLog(entry, { dataDir = getDefaultDataDir() } = {}) {
  const id = createCompactOutputId(entry)
  const logsDir = getCompactLogsDir(dataDir)
  const logPath = getCompactLogPath(id, dataDir)
  const payload = {
    schemaVersion: 1,
    id,
    ...entry
  }

  await mkdir(logsDir, { recursive: true })
  await writeFile(logPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')

  return {
    id,
    logPath,
    payload
  }
}

export async function readCompactLog(id, { dataDir = getDefaultDataDir() } = {}) {
  return JSON.parse(await readFile(getCompactLogPath(id, dataDir), 'utf8'))
}

export async function listCompactLogIds({ dataDir = getDefaultDataDir() } = {}) {
  try {
    const entries = await readdir(getCompactLogsDir(dataDir), { withFileTypes: true })
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
      .map((entry) => entry.name.replace(/\.json$/, ''))
      .sort()
  } catch (error) {
    if (error?.code === 'ENOENT') return []
    throw error
  }
}

export function formatCompactLog(log) {
  const lines = [
    `Pixel compact output: ${log.id}`,
    `Command: ${log.command}`,
    `Cwd: ${log.cwd}`,
    `Exit code: ${log.exitCode}`,
    `Started: ${log.startedAt}`,
    `Ended: ${log.endedAt}`,
    ''
  ]

  if (log.stdout) {
    lines.push('--- stdout ---', log.stdout.trimEnd(), '')
  }

  if (log.stderr) {
    lines.push('--- stderr ---', log.stderr.trimEnd(), '')
  }

  if (!log.stdout && !log.stderr) {
    lines.push('(no stdout or stderr captured)', '')
  }

  return `${lines.join('\n').trimEnd()}\n`
}
