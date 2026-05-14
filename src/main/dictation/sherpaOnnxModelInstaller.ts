import { createWriteStream, existsSync, readFileSync, statSync } from 'fs'
import { mkdir, readdir, rename, rm, stat, writeFile } from 'fs/promises'
import { once } from 'events'
import { dirname, join } from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import {
  SHERPA_ONNX_PARAKEET_MODEL_DOWNLOAD_SIZE_LABEL,
  SHERPA_ONNX_PARAKEET_MODEL_ID,
  SHERPA_ONNX_PARAKEET_MODEL_URL,
  type DictationModelInstallSnapshot
} from '../../shared/dictation'

const execFileAsync = promisify(execFile)

const MODEL_ARCHIVE_FILE = `${SHERPA_ONNX_PARAKEET_MODEL_ID}.tar.bz2`
const MODEL_MANIFEST_FILE = 'pixel-install-manifest.json'
const MODEL_MANIFEST_REQUIRED_FILES_VERSION = 2
const REQUIRED_MODEL_FILES = [
  'encoder.int8.onnx',
  'decoder.int8.onnx',
  'joiner.int8.onnx',
  'tokens.txt'
] as const
const DOWNLOAD_PROGRESS_EMIT_INTERVAL_MS = 150

export type SherpaOnnxModelFile = {
  path: string
  size: number
}

type SherpaOnnxModelManifest = {
  downloadedAt: string
  files: SherpaOnnxModelFile[]
  requiredFilesVersion: number
  sourceUrl: string
  totalBytes: number
}

type SherpaOnnxModelInstallerOptions = {
  extractArchive?: (archivePath: string, destinationPath: string) => Promise<void>
  fetchImpl?: typeof fetch
  getUserDataPath: () => string
  onChange?: () => void
}

export class SherpaOnnxModelInstaller {
  private installPromise: Promise<DictationModelInstallSnapshot> | null = null
  private snapshot: DictationModelInstallSnapshot | null = null
  private readonly fetchImpl: typeof fetch
  private readonly extractArchive: (archivePath: string, destinationPath: string) => Promise<void>

  constructor(private readonly options: SherpaOnnxModelInstallerOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch
    this.extractArchive = options.extractArchive ?? extractTarBz2Archive
  }

  getInstallPath(): string {
    return join(this.options.getUserDataPath(), 'dictation', SHERPA_ONNX_PARAKEET_MODEL_ID)
  }

  getSnapshot(): DictationModelInstallSnapshot {
    if (this.snapshot?.status === 'checking' || this.snapshot?.status === 'downloading') {
      return this.snapshot
    }

    const manifest = this.readInstalledManifest()
    if (manifest && this.isManifestComplete(manifest)) {
      return this.createSnapshot({
        downloadedBytes: manifest.totalBytes,
        installPath: this.getInstallPath(),
        percent: 100,
        status: 'installed',
        totalBytes: manifest.totalBytes
      })
    }

    if (this.snapshot?.status === 'failed') {
      return this.snapshot
    }

    return this.createSnapshot({
      downloadedBytes: 0,
      installPath: this.getInstallPath(),
      percent: 0,
      status: 'not_installed',
      totalBytes: 0
    })
  }

  async install(): Promise<DictationModelInstallSnapshot> {
    if (this.installPromise) return this.installPromise

    this.installPromise = this.runInstall().finally(() => {
      this.installPromise = null
    })

    return this.installPromise
  }

  private async runInstall(): Promise<DictationModelInstallSnapshot> {
    const dictationDirectory = join(this.options.getUserDataPath(), 'dictation')
    const installPath = this.getInstallPath()
    const temporaryRoot = join(dictationDirectory, `${SHERPA_ONNX_PARAKEET_MODEL_ID}.tmp`)
    const archivePath = join(temporaryRoot, MODEL_ARCHIVE_FILE)
    const extractedPath = join(temporaryRoot, 'extracted')
    const stagedInstallPath = join(temporaryRoot, 'installed')

    try {
      this.updateSnapshot({
        downloadedBytes: 0,
        installPath,
        message: 'Checking required Parakeet ONNX assets...',
        percent: 0,
        status: 'checking',
        totalBytes: 0
      })

      await rm(temporaryRoot, { force: true, recursive: true })
      await mkdir(extractedPath, { recursive: true })

      const totalBytes = await this.downloadArchive(archivePath)
      this.updateSnapshot({
        downloadedBytes: totalBytes,
        installPath,
        message: 'Extracting Parakeet ONNX multilingual model...',
        percent: 100,
        status: 'downloading',
        totalBytes
      })

      await this.extractArchive(archivePath, extractedPath)
      const extractedModelPath = await this.resolveExtractedModelPath(extractedPath)
      const files = await this.collectRequiredFiles(extractedModelPath)

      await rm(stagedInstallPath, { force: true, recursive: true })
      await mkdir(stagedInstallPath, { recursive: true })
      for (const file of files) {
        await rename(join(extractedModelPath, file.path), join(stagedInstallPath, file.path))
      }

      await this.writeManifest(files, totalBytes, stagedInstallPath)
      await rm(installPath, { force: true, recursive: true })
      await mkdir(dirname(installPath), { recursive: true })
      await rename(stagedInstallPath, installPath)

      this.updateSnapshot({
        downloadedBytes: totalBytes,
        installPath,
        message: 'Parakeet ONNX model installed locally.',
        percent: 100,
        status: 'installed',
        totalBytes
      })
    } catch (error) {
      this.updateSnapshot({
        downloadedBytes: this.snapshot?.downloadedBytes ?? 0,
        installPath,
        message: error instanceof Error ? error.message : 'Could not install Parakeet ONNX model.',
        percent: this.snapshot?.percent ?? 0,
        status: 'failed',
        totalBytes: this.snapshot?.totalBytes ?? 0
      })
    } finally {
      await rm(temporaryRoot, { force: true, recursive: true })
    }

    return this.getSnapshot()
  }

  private async downloadArchive(targetPath: string): Promise<number> {
    await mkdir(dirname(targetPath), { recursive: true })
    await rm(targetPath, { force: true })

    const response = await this.fetchImpl(SHERPA_ONNX_PARAKEET_MODEL_URL)
    if (!response.ok || !response.body) {
      throw new Error('Could not download Parakeet ONNX multilingual model archive.')
    }

    const totalBytes = Number.parseInt(response.headers.get('content-length') ?? '', 10)
    const expectedBytes = Number.isFinite(totalBytes) && totalBytes > 0 ? totalBytes : 0
    const writer = createWriteStream(targetPath, { flags: 'w' })
    const reader = response.body.getReader()
    let downloadedBytes = 0
    let lastEmitAt = 0

    try {
      while (true) {
        const chunk = await reader.read()
        if (chunk.done) break

        const value = chunk.value
        downloadedBytes += value.byteLength
        if (!writer.write(Buffer.from(value))) {
          await once(writer, 'drain')
        }

        const now = Date.now()
        if (now - lastEmitAt >= DOWNLOAD_PROGRESS_EMIT_INTERVAL_MS) {
          lastEmitAt = now
          this.updateSnapshot({
            currentFile: MODEL_ARCHIVE_FILE,
            downloadedBytes,
            installPath: this.getInstallPath(),
            message: 'Downloading Parakeet ONNX multilingual model...',
            percent: getPercent(downloadedBytes, expectedBytes),
            status: 'downloading',
            totalBytes: expectedBytes
          })
        }
      }

      writer.end()
      await once(writer, 'finish')
    } catch (error) {
      writer.destroy()
      await rm(targetPath, { force: true })
      throw error
    }

    if (expectedBytes > 0 && downloadedBytes !== expectedBytes) {
      throw new Error('Downloaded Parakeet ONNX archive size did not match the expected size.')
    }

    return expectedBytes > 0 ? expectedBytes : downloadedBytes
  }

  private async resolveExtractedModelPath(extractedPath: string): Promise<string> {
    if (await hasRequiredFiles(extractedPath)) return extractedPath

    const entries = await readdir(extractedPath, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue

      const candidatePath = join(extractedPath, entry.name)
      if (await hasRequiredFiles(candidatePath)) return candidatePath
    }

    throw new Error(
      `Could not find required Parakeet ONNX model files after extraction: ${REQUIRED_MODEL_FILES.join(', ')}.`
    )
  }

  private async collectRequiredFiles(modelPath: string): Promise<SherpaOnnxModelFile[]> {
    const files: SherpaOnnxModelFile[] = []

    for (const relativePath of REQUIRED_MODEL_FILES) {
      const absolutePath = join(modelPath, relativePath)

      let fileStats
      try {
        fileStats = await stat(absolutePath)
      } catch {
        throw new Error(`Missing required Parakeet ONNX model file: ${relativePath}.`)
      }

      files.push({
        path: relativePath,
        size: fileStats.size
      })
    }

    return files.sort((left, right) => left.path.localeCompare(right.path))
  }

  private readInstalledManifest(): SherpaOnnxModelManifest | null {
    const manifestPath = this.resolveModelFilePath(MODEL_MANIFEST_FILE)
    if (!existsSync(manifestPath)) return null

    try {
      return JSON.parse(readFileSync(manifestPath, 'utf8')) as SherpaOnnxModelManifest
    } catch {
      return null
    }
  }

  private resolveModelFilePath(filePath: string): string {
    return join(this.getInstallPath(), filePath)
  }

  private hasCompleteFile(filePath: string, expectedBytes: number): boolean {
    try {
      return statSync(filePath).size === expectedBytes
    } catch {
      return false
    }
  }

  private isManifestComplete(manifest: SherpaOnnxModelManifest): boolean {
    if (manifest.sourceUrl !== SHERPA_ONNX_PARAKEET_MODEL_URL) return false
    if (manifest.requiredFilesVersion !== MODEL_MANIFEST_REQUIRED_FILES_VERSION) return false

    return manifest.files.every((file) =>
      this.hasCompleteFile(this.resolveModelFilePath(file.path), file.size)
    )
  }

  private createSnapshot(
    snapshot: Omit<DictationModelInstallSnapshot, 'requiredBytesLabel' | 'sourceUrl'>
  ): DictationModelInstallSnapshot {
    return {
      requiredBytesLabel: SHERPA_ONNX_PARAKEET_MODEL_DOWNLOAD_SIZE_LABEL,
      sourceUrl: SHERPA_ONNX_PARAKEET_MODEL_URL,
      ...snapshot
    }
  }

  private updateSnapshot(
    snapshot: Omit<DictationModelInstallSnapshot, 'requiredBytesLabel' | 'sourceUrl'>
  ): void {
    this.snapshot = this.createSnapshot(snapshot)
    this.options.onChange?.()
  }

  private async writeManifest(
    files: SherpaOnnxModelFile[],
    totalBytes: number,
    installPath: string
  ): Promise<void> {
    const manifest: SherpaOnnxModelManifest = {
      downloadedAt: new Date().toISOString(),
      files,
      requiredFilesVersion: MODEL_MANIFEST_REQUIRED_FILES_VERSION,
      sourceUrl: SHERPA_ONNX_PARAKEET_MODEL_URL,
      totalBytes
    }
    const manifestPath = join(installPath, MODEL_MANIFEST_FILE)

    await mkdir(dirname(manifestPath), { recursive: true })
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  }
}

async function extractTarBz2Archive(archivePath: string, destinationPath: string): Promise<void> {
  await mkdir(destinationPath, { recursive: true })

  try {
    await execFileAsync('tar', ['-xjf', archivePath, '-C', destinationPath])
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Could not extract Parakeet ONNX model archive: ${error.message}`
        : 'Could not extract Parakeet ONNX model archive.'
    )
  }
}

async function hasRequiredFiles(modelPath: string): Promise<boolean> {
  for (const relativePath of REQUIRED_MODEL_FILES) {
    try {
      const fileStats = await stat(join(modelPath, relativePath))
      if (!fileStats.isFile()) return false
    } catch {
      return false
    }
  }

  return true
}

function getPercent(downloadedBytes: number, totalBytes: number): number {
  if (totalBytes <= 0) return 0

  return Math.min(100, Math.round((downloadedBytes / totalBytes) * 1000) / 10)
}
