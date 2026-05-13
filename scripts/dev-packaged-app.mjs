/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { spawnSync } from 'node:child_process'
import { closeSync, mkdirSync, openSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.dirname(SCRIPT_DIR)
const APP_NAME = 'Pixel Companion Dev'
const APP_ID = 'dev.tomasmuniz.pixel-coding-companion.dev'
const USER_DATA_DIR = 'pixel-coding-companion-dev'
const APP_BUNDLE_PATH = path.join(REPO_ROOT, 'dist-dev/mac-arm64/Pixel Companion Dev.app')
const APP_EXECUTABLE_PATH = path.join(APP_BUNDLE_PATH, 'Contents/MacOS/Pixel Companion Dev')
const LOG_DIR = path.join(os.homedir(), 'Library/Logs/Pixel Companion')
const OUT_LOG_PATH = path.join(LOG_DIR, 'dev-packaged.out.log')
const ERR_LOG_PATH = path.join(LOG_DIR, 'dev-packaged.err.log')
const DATA_DIR = path.join(os.homedir(), 'Library/Application Support/pixel-coding-companion-dev')

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    encoding: 'utf8',
    ...options
  })
}

function findDevAppPids() {
  if (process.platform !== 'darwin') return []

  const result = run('ps', ['-axo', 'pid=,args='])
  if (result.error || result.status !== 0) return []

  return result.stdout
    .split('\n')
    .map((line) => {
      const trimmedLine = line.trim()
      const match = trimmedLine.match(/^(\d+)\s+(.+)$/)
      if (!match) return null

      return {
        args: match[2],
        pid: Number(match[1])
      }
    })
    .filter(
      (processInfo) =>
        processInfo &&
        processInfo.pid !== process.pid &&
        processInfo.args.includes(APP_EXECUTABLE_PATH)
    )
    .map((processInfo) => processInfo.pid)
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

function stopDevApp() {
  const pids = findDevAppPids()
  if (pids.length === 0) return

  for (const pid of pids) {
    try {
      process.kill(pid, 'SIGTERM')
    } catch {
      // The app may already be closed.
    }
  }

  const deadline = Date.now() + 5000
  while (Date.now() < deadline) {
    if (findDevAppPids().length === 0) return
    sleep(150)
  }

  for (const pid of findDevAppPids()) {
    try {
      process.kill(pid, 'SIGKILL')
    } catch {
      // The app may already be closed.
    }
  }
}

function openDevApp() {
  if (process.platform !== 'darwin') {
    throw new Error('open:dev-packaged currently supports the macOS dev bundle only.')
  }

  stopDevApp()
  mkdirSync(LOG_DIR, { recursive: true })
  closeSync(openSync(OUT_LOG_PATH, 'w'))
  closeSync(openSync(ERR_LOG_PATH, 'w'))

  const args = [
    '-n',
    '--stdout',
    OUT_LOG_PATH,
    '--stderr',
    ERR_LOG_PATH,
    '--env',
    `PIXEL_COMPANION_APP_NAME=${APP_NAME}`,
    '--env',
    `PIXEL_COMPANION_APP_ID=${APP_ID}`,
    '--env',
    `PIXEL_COMPANION_USER_DATA_DIR=${USER_DATA_DIR}`,
    '--env',
    `PIXEL_COMPANION_DATA_DIR=${DATA_DIR}`,
    APP_BUNDLE_PATH
  ]

  const remoteDebuggingPort = process.env.PIXEL_COMPANION_DEV_REMOTE_DEBUGGING_PORT?.trim()
  if (remoteDebuggingPort) {
    args.push('--args', `--remote-debugging-port=${remoteDebuggingPort}`)
  }

  const result = run('open', args, { stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(`open exited with status ${result.status ?? 'unknown'}`)
  }
}

const command = process.argv[2]

if (command === 'stop') {
  stopDevApp()
} else if (command === 'open') {
  openDevApp()
} else {
  console.error('Usage: node scripts/dev-packaged-app.mjs <stop|open>')
  process.exit(1)
}
