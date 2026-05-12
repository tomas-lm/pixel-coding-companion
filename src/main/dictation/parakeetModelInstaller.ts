import { createWriteStream, existsSync, readFileSync, statSync } from 'fs'
import { mkdir, rename, rm, stat, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { once } from 'events'
import {
  PARAKEET_COREML_MODEL_DOWNLOAD_SIZE_LABEL,
  PARAKEET_COREML_MODEL_URL,
  type DictationModelInstallSnapshot
} from '../../shared/dictation'

const HF_REPO_ID = 'FluidInference/parakeet-tdt-0.6b-v3-coreml'
const HF_REVISION = 'main'
const MODEL_DIR_NAME = 'parakeet-tdt-0.6b-v3-coreml'
const MODEL_MANIFEST_FILE = 'pixel-install-manifest.json'
const MODEL_MANIFEST_REQUIRED_ROOTS_VERSION = 2
const REQUIRED_MODEL_ROOTS = [
  'Preprocessor.mlmodelc',
  'Encoder.mlmodelc',
  'Decoder.mlmodelc',
  'JointDecisionv3.mlmodelc'
]
const REQUIRED_VOCAB_FILE = 'parakeet_vocab.json'
const DOWNLOAD_PROGRESS_EMIT_INTERVAL_MS = 150

type HuggingFaceTreeEntry = {
  path?: string
  size?: number
  type?: string
}

export type ParakeetModelFile = {
  path: string
  size: number
}

type ParakeetModelManifest = {
  downloadedAt: string
  files: ParakeetModelFile[]
  requiredRootsVersion: number
  repoId: string
  revision: string
  totalBytes: number
}

type ParakeetModelInstallerOptions = {
  getUserDataPath: () => string
  onChange?: () => void
}

export class ParakeetModelInstaller {
  private installPromise: Promise<DictationModelInstallSnapshot> | null = null
  private snapshot: DictationModelInstallSnapshot | null = null

  constructor(private readonly options: ParakeetModelInstallerOptions) {}

  getInstallPath(): string {
    return join(this.options.getUserDataPath(), 'dictation', MODEL_DIR_NAME)
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
        message: 'Checking required Parakeet model assets...',
        percent: 0,
        status: 'checking',
        totalBytes: 0
      })

      const files = await fetchRequiredParakeetModelFiles()
      const totalBytes = getTotalBytes(files)
      let downloadedBytes = await this.getExistingDownloadedBytes(files)

      this.updateSnapshot({
        downloadedBytes,
        installPath: this.getInstallPath(),
        message: 'Downloading required Parakeet Core ML assets...',
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
        message: 'Parakeet model installed locally.',
        percent: 100,
        status: 'installed',
        totalBytes
      })
    } catch (error) {
      this.updateSnapshot({
        downloadedBytes: this.snapshot?.downloadedBytes ?? 0,
        installPath: this.getInstallPath(),
        message: error instanceof Error ? error.message : 'Could not install Parakeet model.',
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
    file: ParakeetModelFile
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
            message: 'Downloading required Parakeet Core ML assets...',
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

  private async getExistingDownloadedBytes(files: ParakeetModelFile[]): Promise<number> {
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

  private isManifestComplete(manifest: ParakeetModelManifest): boolean {
    if (manifest.repoId !== HF_REPO_ID || manifest.revision !== HF_REVISION) return false
    if (manifest.requiredRootsVersion !== MODEL_MANIFEST_REQUIRED_ROOTS_VERSION) return false

    return manifest.files.every((file) =>
      this.hasCompleteFile(this.resolveModelFilePath(file.path), file.size)
    )
  }

  private readInstalledManifest(): ParakeetModelManifest | null {
    const manifestPath = this.resolveModelFilePath(MODEL_MANIFEST_FILE)
    if (!existsSync(manifestPath)) return null

    try {
      return JSON.parse(readFileSync(manifestPath, 'utf8')) as ParakeetModelManifest
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
      requiredBytesLabel: PARAKEET_COREML_MODEL_DOWNLOAD_SIZE_LABEL,
      sourceUrl: PARAKEET_COREML_MODEL_URL,
      ...snapshot
    }
  }

  private updateSnapshot(
    snapshot: Omit<DictationModelInstallSnapshot, 'requiredBytesLabel' | 'sourceUrl'>
  ): void {
    this.snapshot = this.createSnapshot(snapshot)
    this.options.onChange?.()
  }

  private async writeManifest(files: ParakeetModelFile[], totalBytes: number): Promise<void> {
    const manifest: ParakeetModelManifest = {
      downloadedAt: new Date().toISOString(),
      files,
      requiredRootsVersion: MODEL_MANIFEST_REQUIRED_ROOTS_VERSION,
      repoId: HF_REPO_ID,
      revision: HF_REVISION,
      totalBytes
    }
    const manifestPath = this.resolveModelFilePath(MODEL_MANIFEST_FILE)

    await mkdir(dirname(manifestPath), { recursive: true })
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  }
}

export async function fetchRequiredParakeetModelFiles(): Promise<ParakeetModelFile[]> {
  const files: ParakeetModelFile[] = []

  for (const rootPath of REQUIRED_MODEL_ROOTS) {
    const entries = await fetchHuggingFaceTree(rootPath, true)
    files.push(...entriesToFiles(entries))
  }

  const rootEntries = await fetchHuggingFaceTree(undefined, false)
  const vocabFile = entriesToFiles(rootEntries).find((entry) => entry.path === REQUIRED_VOCAB_FILE)
  if (!vocabFile) {
    throw new Error('Could not find Parakeet vocabulary file in Hugging Face model repository.')
  }

  files.push(vocabFile)
  return files.sort((left, right) => left.path.localeCompare(right.path))
}

function entriesToFiles(entries: HuggingFaceTreeEntry[]): ParakeetModelFile[] {
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

async function fetchHuggingFaceTree(
  path: string | undefined,
  recursive: boolean
): Promise<HuggingFaceTreeEntry[]> {
  const pathSegment = path ? `/${encodeModelPath(path)}` : ''
  const url = `https://huggingface.co/api/models/${HF_REPO_ID}/tree/${HF_REVISION}${pathSegment}?recursive=${String(
    recursive
  )}&expand=true`
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error('Could not read Parakeet model metadata from Hugging Face.')
  }

  const payload = (await response.json()) as unknown
  if (!Array.isArray(payload)) {
    throw new Error('Hugging Face returned an unexpected Parakeet model metadata response.')
  }

  return payload as HuggingFaceTreeEntry[]
}

function getModelResolveUrl(path: string): string {
  return `https://huggingface.co/${HF_REPO_ID}/resolve/${HF_REVISION}/${encodeModelPath(path)}`
}

function encodeModelPath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/')
}

function getPercent(downloadedBytes: number, totalBytes: number): number {
  if (totalBytes <= 0) return 0

  return Math.min(100, Math.round((downloadedBytes / totalBytes) * 1000) / 10)
}

function getTotalBytes(files: ParakeetModelFile[]): number {
  return files.reduce((totalBytes, file) => totalBytes + file.size, 0)
}
