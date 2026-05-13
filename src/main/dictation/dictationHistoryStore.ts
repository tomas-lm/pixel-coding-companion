import { appendFile, copyFile, mkdir, readFile, readdir, rm, stat, writeFile } from 'fs/promises'
import { basename, join, relative, resolve } from 'path'
import type {
  DictationHistoryEntry,
  DictationHistoryListRequest,
  DictationHistoryListResult,
  DictationInsertTarget,
  DictationStatsSnapshot,
  DictationTranscript
} from '../../shared/dictation'

const DEFAULT_HISTORY_LIMIT = 50
const MAX_HISTORY_LIMIT = 500

type DictationHistoryStoreOptions = {
  getUserDataPath: () => string
  now?: () => Date
}

type RecordTranscriptRequest = {
  audioFilePath: string
  keepAudioHistory: boolean
  transcript: DictationTranscript
  transcriptId: string
}

function countWords(text: string): number {
  return text.trim().match(/\S+/g)?.length ?? 0
}

function isSameLocalDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  )
}

function normalizeLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit) || !limit) return DEFAULT_HISTORY_LIMIT

  return Math.max(1, Math.min(MAX_HISTORY_LIMIT, Math.floor(limit)))
}

function parseHistoryEntry(line: string): DictationHistoryEntry | null {
  try {
    const value = JSON.parse(line) as Partial<DictationHistoryEntry>
    if (!value.id || !value.createdAt || !value.text || !value.backend) return null

    return {
      audioFilePath: typeof value.audioFilePath === 'string' ? value.audioFilePath : undefined,
      backend: value.backend,
      characterCount:
        typeof value.characterCount === 'number' ? value.characterCount : value.text.length,
      createdAt: value.createdAt,
      durationMs: typeof value.durationMs === 'number' ? value.durationMs : 0,
      estimatedKeystrokesAvoided:
        typeof value.estimatedKeystrokesAvoided === 'number'
          ? value.estimatedKeystrokesAvoided
          : value.text.length,
      id: value.id,
      insertionTarget: value.insertionTarget,
      language: typeof value.language === 'string' ? value.language : undefined,
      text: value.text,
      wordCount: typeof value.wordCount === 'number' ? value.wordCount : countWords(value.text)
    }
  } catch {
    return null
  }
}

export class DictationHistoryStore {
  private readonly getUserDataPath: () => string
  private readonly now: () => Date

  constructor({ getUserDataPath, now = () => new Date() }: DictationHistoryStoreOptions) {
    this.getUserDataPath = getUserDataPath
    this.now = now
  }

  getHistoryDirectory(): string {
    return join(this.getUserDataPath(), 'dictation', 'history')
  }

  getAudioDirectory(): string {
    return join(this.getHistoryDirectory(), 'audio')
  }

  getHistoryFilePath(): string {
    return join(this.getHistoryDirectory(), 'transcripts.jsonl')
  }

  getStatsFilePath(): string {
    return join(this.getUserDataPath(), 'dictation', 'stats.json')
  }

  async recordTranscript({
    audioFilePath,
    keepAudioHistory,
    transcript,
    transcriptId
  }: RecordTranscriptRequest): Promise<DictationHistoryEntry> {
    await mkdir(this.getHistoryDirectory(), { recursive: true })

    const text = transcript.text
    const entry: DictationHistoryEntry = {
      audioFilePath: keepAudioHistory
        ? await this.copyAudioSample(transcriptId, audioFilePath)
        : undefined,
      backend: transcript.backend,
      characterCount: text.length,
      createdAt: this.now().toISOString(),
      durationMs: transcript.durationMs,
      estimatedKeystrokesAvoided: text.length,
      id: transcriptId,
      insertionTarget: undefined,
      language: transcript.language,
      text,
      wordCount: countWords(text)
    }

    await appendFile(this.getHistoryFilePath(), `${JSON.stringify(entry)}\n`, 'utf8')
    await this.writeStatsFile()
    return entry
  }

  async updateInsertionTarget(id: string, insertionTarget: DictationInsertTarget): Promise<void> {
    const entries = await this.readEntries()
    let didUpdate = false
    const nextEntries = entries.map((entry) => {
      if (entry.id !== id) return entry
      didUpdate = true
      return { ...entry, insertionTarget }
    })

    if (!didUpdate) return

    await this.writeEntries(nextEntries)
  }

  async listHistory(
    request: DictationHistoryListRequest = {}
  ): Promise<DictationHistoryListResult> {
    const limit = normalizeLimit(request.limit)
    const query = request.query?.trim().toLocaleLowerCase()
    const entries = (await this.readEntries())
      .filter((entry) => {
        if (!query) return true

        return (
          entry.text.toLocaleLowerCase().includes(query) ||
          entry.createdAt.toLocaleLowerCase().includes(query)
        )
      })
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, limit)

    return { entries }
  }

  async deleteEntry(id: string): Promise<DictationHistoryListResult> {
    const entries = await this.readEntries()
    const entryToDelete = entries.find((entry) => entry.id === id)
    if (!entryToDelete) return this.listHistory()

    await this.deleteAudioFile(entryToDelete.audioFilePath)
    await this.writeEntries(entries.filter((entry) => entry.id !== id))
    return this.listHistory()
  }

  async clearHistory(): Promise<DictationHistoryListResult> {
    await rm(this.getHistoryFilePath(), { force: true })
    await rm(this.getAudioDirectory(), { force: true, recursive: true })
    await this.writeStatsFile()
    return { entries: [] }
  }

  async getStats(): Promise<DictationStatsSnapshot> {
    const statsSnapshot = await this.computeStats()
    await mkdir(join(this.getUserDataPath(), 'dictation'), { recursive: true })
    await writeFile(this.getStatsFilePath(), JSON.stringify(statsSnapshot, null, 2), 'utf8')
    return statsSnapshot
  }

  private async copyAudioSample(transcriptId: string, audioFilePath: string): Promise<string> {
    await mkdir(this.getAudioDirectory(), { recursive: true })

    const extension = basename(audioFilePath).toLocaleLowerCase().endsWith('.wav') ? '.wav' : ''
    const targetPath = join(this.getAudioDirectory(), `${transcriptId}${extension}`)
    await copyFile(audioFilePath, targetPath)
    return targetPath
  }

  private async deleteAudioFile(audioFilePath: string | undefined): Promise<void> {
    if (!audioFilePath) return

    const audioDirectory = resolve(this.getAudioDirectory())
    const resolvedAudioFilePath = resolve(audioFilePath)
    const relativeAudioPath = relative(audioDirectory, resolvedAudioFilePath)
    if (relativeAudioPath.startsWith('..') || relativeAudioPath === '') return

    await rm(resolvedAudioFilePath, { force: true })
  }

  private async readEntries(): Promise<DictationHistoryEntry[]> {
    let contents = ''
    try {
      contents = await readFile(this.getHistoryFilePath(), 'utf8')
    } catch {
      return []
    }

    return contents
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map(parseHistoryEntry)
      .filter((entry): entry is DictationHistoryEntry => Boolean(entry))
  }

  private async writeEntries(entries: DictationHistoryEntry[]): Promise<void> {
    await mkdir(this.getHistoryDirectory(), { recursive: true })
    await writeFile(
      this.getHistoryFilePath(),
      entries.map((entry) => JSON.stringify(entry)).join('\n') + (entries.length > 0 ? '\n' : ''),
      'utf8'
    )
    await this.writeStatsFile()
  }

  private async writeStatsFile(): Promise<void> {
    const statsSnapshot = await this.computeStats()
    await mkdir(join(this.getUserDataPath(), 'dictation'), { recursive: true })
    await writeFile(this.getStatsFilePath(), JSON.stringify(statsSnapshot, null, 2), 'utf8')
  }

  private async computeStats(): Promise<DictationStatsSnapshot> {
    const entries = await this.readEntries()
    const today = this.now()
    const wordsDictatedToday = entries
      .filter((entry) => isSameLocalDay(new Date(entry.createdAt), today))
      .reduce((total, entry) => total + entry.wordCount, 0)
    const totalWordsDictated = entries.reduce((total, entry) => total + entry.wordCount, 0)
    const estimatedKeystrokesAvoided = entries.reduce(
      (total, entry) => total + entry.estimatedKeystrokesAvoided,
      0
    )
    const totalDurationMs = entries.reduce((total, entry) => total + entry.durationMs, 0)
    const audioStorageBytes = await this.getAudioStorageBytes()

    return {
      audioStorageBytes,
      averageWordsPerTranscript:
        entries.length > 0 ? Math.round((totalWordsDictated / entries.length) * 10) / 10 : 0,
      estimatedKeystrokesAvoided,
      totalDurationMs,
      totalTranscripts: entries.length,
      totalWordsDictated,
      updatedAt: today.toISOString(),
      wordsDictatedToday
    }
  }

  private async getAudioStorageBytes(): Promise<number> {
    let filenames: string[]
    try {
      filenames = await readdir(this.getAudioDirectory())
    } catch {
      return 0
    }

    let totalBytes = 0
    for (const filename of filenames) {
      try {
        const fileStats = await stat(join(this.getAudioDirectory(), filename))
        if (fileStats.isFile()) totalBytes += fileStats.size
      } catch {
        // Ignore files that disappeared during scanning.
      }
    }

    return totalBytes
  }
}
