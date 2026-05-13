import { createWriteStream, existsSync, readFileSync, statSync } from 'fs'
import { mkdir, rename, rm, stat, writeFile } from 'fs/promises'
import { once } from 'events'
import { dirname, join } from 'path'
import {
  SHERPA_ONNX_PARAKEET_MODEL_DOWNLOAD_SIZE_LABEL,
  SHERPA_ONNX_PARAKEET_MODEL_ID,
  SHERPA_ONNX_PARAKEET_MODEL_URL,
  type DictationModelInstallSnapshot
} from '../../shared/dictation'

const HF_REPO_ID = `csukuangfj/${SHERPA_ONNX_PARAKEET_MODEL_ID}`
const HF_REVISION = 'main'
const MODEL_MANIFEST_FILE = 'pixel-install-manifest.json'
const MODEL_MANIFEST_REQUIRED_FILES_VERSION = 1
const REQUIRED_MODEL_FILES = [
  'encoder.int8.onnx',
  'decoder.int8.onnx',
  'joiner.int8.onnx',
  'tokens.txt'
]
const DOWNLOAD_PROGRESS_EMIT_INTERVAL_MS = 150

type HuggingFaceTreeEntry = {
  path?: string
  size?: number
  type?: string
}

export type SherpaOnnxModelFile = {
  path: string
  size: number
}

type SherpaOnnxModelManifest = {
  downloadedAt: string
  files: SherpaOnnxModelFile[]
  requiredFilesVersion: number
  repoId: string
  revision: string
  totalBytes: number
}

type SherpaOnnxModelInstallerOptions = {
  getUserDataPath: () => string
  onChange?: () => void
}

export class SherpaOnnxModelInstaller {
  private installPromise: Promise<DictationModelInstallSnapshot> | null = null
  private snapshot: DictationModelInstallSnapshot | null = null

  constructor(private readonly options: SherpaOnnxModelInstallerOptions) {}

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
    try {
      this.updateSnapshot({
        downloadedBytes: 0,
        installPath: this.getInstallPath(),
        message: 'Checking required Parakeet ONNX assets...',
        percent: 0,
        status: 'checking',
        totalBytes: 0
      })

      const files = await fetchRequiredSherpaOnnxModelFiles()
      const totalBytes = getTotalBytes(files)
      let downloadedBytes = await this.getExistingDownloadedBytes(files)

      this.updateSnapshot({
        downloadedBytes,
        installPath: this.getInstallPath(),
        message: 'Downloading required Parakeet ONNX assets...',
        percent: getPercent(downloadedBytes, totalBytes),
        status: 'downloading',
        totalBytes
      })

      for (const file of files) {
        const targetPath = this.resolveModelFilePath(file.path)
        if (this.hasCompleteFile(targetPath, file.size)) continue

        downloadedBytes -= await this.getExistingFileBytes(targetPath)
        downloadedBytes += await this.downloadFile({
          alreadyDownloadedBytes: downloadedBytes,
          file,
          targetPath,
          totalBytes
        })
      }

      await this.writeManifest(files, totalBytes)
      this.updateSnapshot({
        downloadedBytes: totalBytes,
        installPath: this.getInstallPath(),
        message: 'Parakeet ONNX model installed locally.',
        percent: 100,
        status: 'installed',
        totalBytes
      })
    } catch (error) {
      this.updateSnapshot({
        downloadedBytes: this.snapshot?.downloadedBytes ?? 0,
        installPath: this.getInstallPath(),
        message: error instanceof Error ? error.message : 'Could not install Parakeet ONNX model.',
        percent: this.snapshot?.percent ?? 0,
        status: 'failed',
        totalBytes: this.snapshot?.totalBytes ?? 0
      })
    }

    return this.getSnapshot()
  }

  private async downloadFile({
    alreadyDownloadedBytes,
    file,
    targetPath,
    totalBytes
  }: {
    alreadyDownloadedBytes: number
    file: SherpaOnnxModelFile
    targetPath: string
    totalBytes: number
  }): Promise<number> {
    const temporaryPath = `${targetPath}.download`
    await mkdir(dirname(targetPath), { recursive: true })
    await rm(temporaryPath, { force: true })

    const response = await fetch(getModelResolveUrl(file.path))
    if (!response.ok || !response.body) {
      throw new Error(`Could not download ${file.path} from Hugging Face.`)
    }

    const writer = createWriteStream(temporaryPath, { flags: 'w' })
    const reader = response.body.getReader()
    let fileDownloadedBytes = 0
    let lastEmitAt = 0

    try {
      while (true) {
        const chunk = await reader.read()
        if (chunk.done) break

        const value = chunk.value
        fileDownloadedBytes += value.byteLength
        if (!writer.write(Buffer.from(value))) {
          await once(writer, 'drain')
        }

        const now = Date.now()
        if (now - lastEmitAt >= DOWNLOAD_PROGRESS_EMIT_INTERVAL_MS) {
          lastEmitAt = now
          const downloadedBytes = alreadyDownloadedBytes + fileDownloadedBytes
          this.updateSnapshot({
            currentFile: file.path,
            downloadedBytes,
            installPath: this.getInstallPath(),
            message: 'Downloading required Parakeet ONNX assets...',
            percent: getPercent(downloadedBytes, totalBytes),
            status: 'downloading',
            totalBytes
          })
        }
      }

      writer.end()
      await once(writer, 'finish')
      if (fileDownloadedBytes !== file.size) {
        throw new Error(`Downloaded ${file.path} but the file size did not match the manifest.`)
      }

      await rename(temporaryPath, targetPath)
    } catch (error) {
      writer.destroy()
      await rm(temporaryPath, { force: true })
      throw error
    }

    return fileDownloadedBytes
  }

  private async getExistingDownloadedBytes(files: SherpaOnnxModelFile[]): Promise<number> {
    let downloadedBytes = 0

    for (const file of files) {
      downloadedBytes += await this.getExistingFileBytes(this.resolveModelFilePath(file.path))
    }

    return Math.min(downloadedBytes, getTotalBytes(files))
  }

  private async getExistingFileBytes(filePath: string): Promise<number> {
    try {
      return (await stat(filePath)).size
    } catch {
      return 0
    }
  }

  private hasCompleteFile(filePath: string, expectedBytes: number): boolean {
    try {
      return statSync(filePath).size === expectedBytes
    } catch {
      return false
    }
  }

  private isManifestComplete(manifest: SherpaOnnxModelManifest): boolean {
    if (manifest.repoId !== HF_REPO_ID || manifest.revision !== HF_REVISION) return false
    if (manifest.requiredFilesVersion !== MODEL_MANIFEST_REQUIRED_FILES_VERSION) return false

    return manifest.files.every((file) =>
      this.hasCompleteFile(this.resolveModelFilePath(file.path), file.size)
    )
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

  private async writeManifest(files: SherpaOnnxModelFile[], totalBytes: number): Promise<void> {
    const manifest: SherpaOnnxModelManifest = {
      downloadedAt: new Date().toISOString(),
      files,
      requiredFilesVersion: MODEL_MANIFEST_REQUIRED_FILES_VERSION,
      repoId: HF_REPO_ID,
      revision: HF_REVISION,
      totalBytes
    }
    const manifestPath = this.resolveModelFilePath(MODEL_MANIFEST_FILE)

    await mkdir(dirname(manifestPath), { recursive: true })
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  }
}

export async function fetchRequiredSherpaOnnxModelFiles(): Promise<SherpaOnnxModelFile[]> {
  const entries = await fetchHuggingFaceTree()
  const files = entriesToFiles(entries)
  const requiredFiles = REQUIRED_MODEL_FILES.map((path) => {
    const file = files.find((entry) => entry.path === path)
    if (!file) throw new Error(`Could not find ${path} in Hugging Face model repository.`)

    return file
  })

  return requiredFiles.sort((left, right) => left.path.localeCompare(right.path))
}

function entriesToFiles(entries: HuggingFaceTreeEntry[]): SherpaOnnxModelFile[] {
  return entries
    .filter(
      (entry): entry is Required<Pick<HuggingFaceTreeEntry, 'path' | 'size'>> =>
        entry.type === 'file' && typeof entry.path === 'string' && typeof entry.size === 'number'
    )
    .map((entry) => ({
      path: entry.path,
      size: entry.size
    }))
}

async function fetchHuggingFaceTree(): Promise<HuggingFaceTreeEntry[]> {
  const url = `https://huggingface.co/api/models/${HF_REPO_ID}/tree/${HF_REVISION}?recursive=false&expand=true`
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error('Could not read Parakeet ONNX model metadata from Hugging Face.')
  }

  const payload = (await response.json()) as unknown
  if (!Array.isArray(payload)) {
    throw new Error('Hugging Face returned an unexpected Parakeet ONNX metadata response.')
  }

  return payload as HuggingFaceTreeEntry[]
}

function getModelResolveUrl(path: string): string {
  return `https://huggingface.co/${HF_REPO_ID}/resolve/${HF_REVISION}/${encodeURIComponent(path)}`
}

function getPercent(downloadedBytes: number, totalBytes: number): number {
  if (totalBytes <= 0) return 0

  return Math.min(100, Math.round((downloadedBytes / totalBytes) * 1000) / 10)
}

function getTotalBytes(files: SherpaOnnxModelFile[]): number {
  return files.reduce((totalBytes, file) => totalBytes + file.size, 0)
}
