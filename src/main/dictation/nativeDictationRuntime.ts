import { spawn } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'

const HELPER_NAME = 'pixel-dictation-helper'
const GLOBAL_SHORTCUT_ADDON_NAME = 'pixel_global_shortcut.node'
const TRANSCRIPTION_TIMEOUT_MS = 180_000

type NativeDictationRuntimeOptions = {
  getAppPath: () => string
  getResourcesPath: () => string
  getWorkingDirectory?: () => string
}

type NativeTranscriptionResult = {
  confidence?: number
  durationMs?: number
  language?: string
  text?: string
}

export type NativeDictationTranscriptionInput = {
  audioFilePath: string
  modelPath: string
}

export class NativeDictationRuntime {
  private readonly getAppPath: () => string
  private readonly getResourcesPath: () => string
  private readonly getWorkingDirectory: () => string

  constructor({
    getAppPath,
    getResourcesPath,
    getWorkingDirectory = () => process.cwd()
  }: NativeDictationRuntimeOptions) {
    this.getAppPath = getAppPath
    this.getResourcesPath = getResourcesPath
    this.getWorkingDirectory = getWorkingDirectory
  }

  getHelperPath(): string | null {
    if (process.platform !== 'darwin') return null

    for (const candidate of this.getHelperPathCandidates()) {
      if (existsSync(candidate)) return candidate
    }

    return null
  }

  getGlobalShortcutAddonPath(): string | null {
    if (process.platform !== 'darwin') return null

    for (const candidate of this.getGlobalShortcutAddonPathCandidates()) {
      if (existsSync(candidate)) return candidate
    }

    return null
  }

  isAvailable(): boolean {
    return this.getHelperPath() !== null
  }

  async transcribe({
    audioFilePath,
    modelPath
  }: NativeDictationTranscriptionInput): Promise<NativeTranscriptionResult> {
    const helperPath = this.getHelperPath()
    if (!helperPath) {
      throw new Error('Pixel dictation helper is not built. Run npm run build:native:dictation.')
    }

    const output = await runHelper(helperPath, [
      'transcribe',
      '--model-dir',
      modelPath,
      '--audio',
      audioFilePath
    ])
    const result = parseHelperOutput(output.stdout)

    if (!result.text?.trim()) {
      throw new Error('Parakeet returned an empty transcript.')
    }

    return result
  }

  private getHelperPathCandidates(): string[] {
    const appPath = this.getAppPath()
    const resourcesPath = this.getResourcesPath()
    const cwd = this.getWorkingDirectory()

    return [
      join(resourcesPath, 'app.asar.unpacked', 'resources', 'native', HELPER_NAME),
      join(resourcesPath, 'native', HELPER_NAME),
      join(appPath, 'resources', 'native', HELPER_NAME),
      join(cwd, 'resources', 'native', HELPER_NAME),
      join(cwd, 'native', 'pixel-dictation-helper', '.build', 'release', HELPER_NAME)
    ]
  }

  private getGlobalShortcutAddonPathCandidates(): string[] {
    const appPath = this.getAppPath()
    const resourcesPath = this.getResourcesPath()
    const cwd = this.getWorkingDirectory()

    return [
      join(resourcesPath, 'app.asar.unpacked', 'resources', 'native', GLOBAL_SHORTCUT_ADDON_NAME),
      join(resourcesPath, 'native', GLOBAL_SHORTCUT_ADDON_NAME),
      join(appPath, 'resources', 'native', GLOBAL_SHORTCUT_ADDON_NAME),
      join(cwd, 'resources', 'native', GLOBAL_SHORTCUT_ADDON_NAME),
      join(cwd, 'native', 'pixel-global-shortcut', 'build', 'Release', GLOBAL_SHORTCUT_ADDON_NAME)
    ]
  }
}

function runHelper(
  helperPath: string,
  args: string[]
): Promise<{
  stderr: string
  stdout: string
}> {
  return new Promise((resolve, reject) => {
    const child = spawn(helperPath, args, {
      env: {
        ...process.env,
        OS_ACTIVITY_MODE: 'disable'
      },
      stdio: ['ignore', 'pipe', 'pipe']
    })
    const stdoutChunks: Buffer[] = []
    const stderrChunks: Buffer[] = []
    const timeout = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error('Parakeet transcription timed out.'))
    }, TRANSCRIPTION_TIMEOUT_MS)

    child.stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk))
    child.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk))
    child.on('error', (error) => {
      clearTimeout(timeout)
      reject(error)
    })
    child.on('close', (code) => {
      clearTimeout(timeout)
      const stdout = Buffer.concat(stdoutChunks).toString('utf8')
      const stderr = Buffer.concat(stderrChunks).toString('utf8')

      if (code !== 0) {
        reject(new Error(readHelperError(stderr) ?? 'Parakeet transcription failed.'))
        return
      }

      resolve({ stderr, stdout })
    })
  })
}

function parseHelperOutput(stdout: string): NativeTranscriptionResult {
  const jsonLine = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .at(-1)

  if (!jsonLine) throw new Error('Parakeet helper returned no transcript output.')

  return JSON.parse(jsonLine) as NativeTranscriptionResult
}

function readHelperError(stderr: string): string | null {
  const jsonLine = stderr
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .at(-1)

  if (!jsonLine) return null

  try {
    const output = JSON.parse(jsonLine) as { error?: string }
    return output.error ?? null
  } catch {
    return jsonLine
  }
}
