import { mkdtemp, readFile, stat, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DictationHistoryStore } from './dictationHistoryStore'

let tempDir: string

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'pixel-dictation-history-'))
})

afterEach(async () => {
  await import('fs/promises').then(({ rm }) => rm(tempDir, { force: true, recursive: true }))
})

function createStore(): DictationHistoryStore {
  return new DictationHistoryStore({
    getUserDataPath: () => tempDir,
    now: () => new Date('2026-05-13T12:00:00.000Z')
  })
}

describe('DictationHistoryStore', () => {
  it('records transcripts and calculates stats', async () => {
    const store = createStore()
    const audioFilePath = join(tempDir, 'sample.wav')
    await writeFile(audioFilePath, Buffer.from([1, 2, 3]))

    await store.recordTranscript({
      audioFilePath,
      keepAudioHistory: false,
      transcript: {
        backend: 'mock',
        durationMs: 1400,
        text: 'hello pixel history'
      },
      transcriptId: 'transcript-1'
    })

    await expect(readFile(store.getHistoryFilePath(), 'utf8')).resolves.toContain(
      'hello pixel history'
    )
    await expect(store.listHistory()).resolves.toMatchObject({
      entries: [
        {
          characterCount: 19,
          estimatedKeystrokesAvoided: 19,
          id: 'transcript-1',
          wordCount: 3
        }
      ]
    })
    await expect(store.getStats()).resolves.toMatchObject({
      totalTranscripts: 1,
      totalWordsDictated: 3,
      wordsDictatedToday: 3
    })
  })

  it('keeps audio only when requested and deletes it with the entry', async () => {
    const store = createStore()
    const audioFilePath = join(tempDir, 'sample.wav')
    await writeFile(audioFilePath, Buffer.from([1, 2, 3]))

    const entry = await store.recordTranscript({
      audioFilePath,
      keepAudioHistory: true,
      transcript: {
        backend: 'mock',
        durationMs: 800,
        text: 'keep this audio'
      },
      transcriptId: 'transcript-audio'
    })

    expect(entry.audioFilePath).toBeTruthy()
    await expect(stat(entry.audioFilePath!)).resolves.toMatchObject({ size: 3 })

    await store.deleteEntry('transcript-audio')

    await expect(stat(entry.audioFilePath!)).rejects.toThrow()
    await expect(store.listHistory()).resolves.toEqual({ entries: [] })
  })

  it('updates insertion targets and supports search', async () => {
    const store = createStore()
    const audioFilePath = join(tempDir, 'sample.wav')
    await writeFile(audioFilePath, Buffer.from([1, 2, 3]))

    await store.recordTranscript({
      audioFilePath,
      keepAudioHistory: false,
      transcript: {
        backend: 'mock',
        durationMs: 900,
        text: 'terminal command'
      },
      transcriptId: 'terminal-entry'
    })
    await store.updateInsertionTarget('terminal-entry', 'terminal')

    await expect(store.listHistory({ query: 'command' })).resolves.toMatchObject({
      entries: [{ id: 'terminal-entry', insertionTarget: 'terminal' }]
    })
    await expect(store.listHistory({ query: 'missing' })).resolves.toEqual({ entries: [] })
  })
})
