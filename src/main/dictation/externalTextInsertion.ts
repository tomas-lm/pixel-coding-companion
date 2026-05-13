import { createRequire } from 'module'
import { clipboard, systemPreferences } from 'electron'
import type { DictationExternalInsertResult } from '../../shared/dictation'
import type { NativeDictationRuntime } from './nativeDictationRuntime'

const nodeRequire = createRequire(__filename)

type NativeExternalTextInsertionAddon = {
  pasteClipboard: () => boolean
}

type ExternalTextInsertionOptions = {
  nativeRuntime?: NativeDictationRuntime
  platform?: NodeJS.Platform
}

export async function insertTextIntoActiveApplication(
  text: string,
  { nativeRuntime, platform = process.platform }: ExternalTextInsertionOptions = {}
): Promise<DictationExternalInsertResult> {
  clipboard.writeText(text)

  if (platform !== 'darwin') {
    return {
      ok: false,
      reason: 'Transcript was copied, but direct paste is only implemented on macOS for now.',
      target: 'clipboard'
    }
  }

  if (!systemPreferences.isTrustedAccessibilityClient(false)) {
    systemPreferences.isTrustedAccessibilityClient(true)

    return {
      ok: false,
      reason:
        'Transcript was copied, but Pixel needs macOS Accessibility permission to paste into other apps.',
      target: 'clipboard'
    }
  }

  if (nativeRuntime && pasteClipboardWithNativeAddon(nativeRuntime)) {
    return {
      ok: true,
      target: 'system_text'
    }
  }

  return {
    ok: false,
    reason: 'Transcript was copied, but Pixel could not load its native macOS paste helper.',
    target: 'clipboard'
  }
}

function pasteClipboardWithNativeAddon(nativeRuntime: NativeDictationRuntime): boolean {
  const addonPath = nativeRuntime.getGlobalShortcutAddonPath()
  if (!addonPath) return false

  try {
    const addon = nodeRequire(addonPath) as Partial<NativeExternalTextInsertionAddon>
    return addon.pasteClipboard?.() === true
  } catch {
    return false
  }
}
