import { mkdtemp, mkdir, readFile, stat, writeFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  SHERPA_ONNX_PARAKEET_MODEL_ID,
  SHERPA_ONNX_PARAKEET_MODEL_URL
} from '../../shared/dictation'
import { SherpaOnnxModelInstaller } from './sherpaOnnxModelInstaller'

const REQUIRED_FILES = {
  'decoder.int8.onnx': 'decoder',
  'encoder.int8.onnx': 'encoder',
  'joiner.int8.onnx': 'joiner',
  'tokens.txt': 'tokens'
} as const

describe('SherpaOnnxModelInstaller', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('downloads the release archive, extracts the required files, and writes a manifest', async () => {
    const userDataPath = await mkdtemp(join(tmpdir(), 'pixel-sherpa-model-'))
    const onChange = vi.fn()
    const archiveBytes = Buffer.from('fake archive payload')
    const fetchImpl = vi.fn(async () => createArchiveResponse(archiveBytes))
    const extractArchive = vi.fn(async (_archivePath: string, destinationPath: string) => {
      const extractedModelPath = join(destinationPath, SHERPA_ONNX_PARAKEET_MODEL_ID)
      await mkdir(extractedModelPath, { recursive: true })

      await Promise.all(
        Object.entries(REQUIRED_FILES).map(([filename, contents]) =>
          writeFile(join(extractedModelPath, filename), contents, 'utf8')
        )
      )
    })

    const installer = new SherpaOnnxModelInstaller({
      extractArchive,
      fetchImpl,
      getUserDataPath: () => userDataPath,
      onChange
    })

    const snapshot = await installer.install()
    const installPath = join(userDataPath, 'dictation', SHERPA_ONNX_PARAKEET_MODEL_ID)
    const manifestPath = join(installPath, 'pixel-install-manifest.json')
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
      files: Array<{ path: string; size: number }>
      requiredFilesVersion: number
      sourceUrl: string
      totalBytes: number
    }

    expect(fetchImpl).toHaveBeenCalledWith(SHERPA_ONNX_PARAKEET_MODEL_URL)
    expect(extractArchive).toHaveBeenCalledOnce()
    expect(snapshot).toMatchObject({
      installPath,
      requiredBytesLabel: '~350 MB',
      sourceUrl: SHERPA_ONNX_PARAKEET_MODEL_URL,
      status: 'installed',
      totalBytes: archiveBytes.byteLength
    })
    expect(onChange).toHaveBeenCalled()
    expect(manifest.requiredFilesVersion).toBe(2)
    expect(manifest.sourceUrl).toBe(SHERPA_ONNX_PARAKEET_MODEL_URL)
    expect(manifest.totalBytes).toBe(archiveBytes.byteLength)
    expect(manifest.files.map((file) => file.path)).toEqual([
      'decoder.int8.onnx',
      'encoder.int8.onnx',
      'joiner.int8.onnx',
      'tokens.txt'
    ])

    await Promise.all(
      Object.entries(REQUIRED_FILES).map(async ([filename, contents]) => {
        await expect(readFile(join(installPath, filename), 'utf8')).resolves.toBe(contents)
      })
    )
    await expect(stat(join(installPath, 'pixel-install-manifest.json'))).resolves.toMatchObject({
      isFile: expect.any(Function)
    })
    expect(installer.getSnapshot()).toMatchObject({
      installPath,
      status: 'installed',
      totalBytes: archiveBytes.byteLength
    })
  })

  it('does not treat the old v2 cache as an installed v3 model', async () => {
    const userDataPath = await mkdtemp(join(tmpdir(), 'pixel-sherpa-model-'))
    await mkdir(
      join(userDataPath, 'dictation', 'sherpa-onnx-nemo-parakeet-tdt-0.6b-v2-int8'),
      { recursive: true }
    )

    const installer = new SherpaOnnxModelInstaller({
      getUserDataPath: () => userDataPath
    })

    expect(installer.getSnapshot()).toMatchObject({
      installPath: join(userDataPath, 'dictation', SHERPA_ONNX_PARAKEET_MODEL_ID),
      status: 'not_installed'
    })
  })

  it('fails installation when the extracted archive is missing required files', async () => {
    const userDataPath = await mkdtemp(join(tmpdir(), 'pixel-sherpa-model-'))
    const archiveBytes = Buffer.from('fake archive payload')
    const fetchImpl = vi.fn(async () => createArchiveResponse(archiveBytes))
    const extractArchive = vi.fn(async (_archivePath: string, destinationPath: string) => {
      const extractedModelPath = join(destinationPath, SHERPA_ONNX_PARAKEET_MODEL_ID)
      await mkdir(extractedModelPath, { recursive: true })
      await writeFile(join(extractedModelPath, 'encoder.int8.onnx'), 'encoder', 'utf8')
      await writeFile(join(extractedModelPath, 'decoder.int8.onnx'), 'decoder', 'utf8')
      await writeFile(join(extractedModelPath, 'joiner.int8.onnx'), 'joiner', 'utf8')
    })

    const installer = new SherpaOnnxModelInstaller({
      extractArchive,
      fetchImpl,
      getUserDataPath: () => userDataPath
    })

    const snapshot = await installer.install()

    expect(snapshot).toMatchObject({
      message:
        'Could not find required Parakeet ONNX model files after extraction: encoder.int8.onnx, decoder.int8.onnx, joiner.int8.onnx, tokens.txt.',
      status: 'failed'
    })
    await expect(
      stat(join(userDataPath, 'dictation', SHERPA_ONNX_PARAKEET_MODEL_ID, 'pixel-install-manifest.json'))
    ).rejects.toThrow()
  })
})

function createArchiveResponse(body: Buffer): Response {
  return new Response(new Uint8Array(body), {
    headers: {
      'content-length': String(body.byteLength),
      'content-type': 'application/x-bzip2'
    },
    status: 200
  })
}
