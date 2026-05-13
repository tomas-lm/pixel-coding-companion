import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { clipboard, systemPreferences } from 'electron'
import { insertTextIntoActiveApplication } from './externalTextInsertion'
import type { NativeDictationRuntime } from './nativeDictationRuntime'

vi.mock('electron', () => ({
  clipboard: {
    writeText: vi.fn()
  },
  systemPreferences: {
    isTrustedAccessibilityClient: vi.fn()
  }
}))

afterEach(() => {
  vi.clearAllMocks()
})

describe('insertTextIntoActiveApplication', () => {
  it('uses the native Pixel paste helper on macOS when Accessibility is trusted', async () => {
    const fixtureDir = mkdtempSync(join(tmpdir(), 'pixel-native-paste-'))
    const addonPath = join(fixtureDir, 'addon.cjs')
    writeFileSync(addonPath, 'module.exports = { pasteClipboard: () => true }')

    vi.mocked(systemPreferences.isTrustedAccessibilityClient).mockReturnValue(true)

    const result = await insertTextIntoActiveApplication('hello outside app', {
      nativeRuntime: nativeRuntimeFor(addonPath),
      platform: 'darwin'
    })

    expect(result).toEqual({ ok: true, target: 'system_text' })
    expect(clipboard.writeText).toHaveBeenCalledWith('hello outside app')
    expect(systemPreferences.isTrustedAccessibilityClient).toHaveBeenCalledWith(false)
    rmSync(fixtureDir, { force: true, recursive: true })
  })

  it('keeps the transcript on the clipboard while requesting Accessibility when macOS is not trusted', async () => {
    vi.mocked(systemPreferences.isTrustedAccessibilityClient)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(false)

    const result = await insertTextIntoActiveApplication('clipboard fallback', {
      nativeRuntime: nativeRuntimeFor('/missing/addon.cjs'),
      platform: 'darwin'
    })

    expect(result).toMatchObject({
      ok: false,
      target: 'clipboard'
    })
    expect(clipboard.writeText).toHaveBeenCalledWith('clipboard fallback')
    expect(systemPreferences.isTrustedAccessibilityClient).toHaveBeenCalledWith(true)
  })
})

function nativeRuntimeFor(addonPath: string): NativeDictationRuntime {
  return {
    getGlobalShortcutAddonPath: () => addonPath
  } as NativeDictationRuntime
}
