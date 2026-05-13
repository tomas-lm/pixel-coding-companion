import { BrowserWindow } from 'electron'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { DICTATION_CHANNELS } from '../../shared/dictation'
import { createDictationOverlayWindow } from '../window/createDictationOverlayWindow'

type DictationOverlaySettings = {
  bounds?: Electron.Rectangle
  enabled: boolean
}

type DictationOverlayManagerOptions = {
  appName: string
  getMainWindow: () => BrowserWindow | null
  getUserDataPath: () => string
  icon: string
  isDev: boolean
  isSafeExternalUrl: (url: string) => boolean
  rendererUrl?: string
  showMainWindow: () => void
}

const DEFAULT_OVERLAY_SETTINGS: DictationOverlaySettings = {
  enabled: false
}

export class DictationOverlayManager {
  private readonly appName: string
  private readonly getMainWindow: () => BrowserWindow | null
  private readonly getUserDataPath: () => string
  private readonly icon: string
  private readonly isDev: boolean
  private readonly isSafeExternalUrl: (url: string) => boolean
  private readonly rendererUrl?: string
  private readonly showMainWindow: () => void
  private overlayWindow: BrowserWindow | null = null
  private settings: DictationOverlaySettings = DEFAULT_OVERLAY_SETTINGS

  constructor({
    appName,
    getMainWindow,
    getUserDataPath,
    icon,
    isDev,
    isSafeExternalUrl,
    rendererUrl,
    showMainWindow
  }: DictationOverlayManagerOptions) {
    this.appName = appName
    this.getMainWindow = getMainWindow
    this.getUserDataPath = getUserDataPath
    this.icon = icon
    this.isDev = isDev
    this.isSafeExternalUrl = isSafeExternalUrl
    this.rendererUrl = rendererUrl
    this.showMainWindow = showMainWindow
  }

  getOverlayWindow(): BrowserWindow | null {
    return this.overlayWindow
  }

  isOverlayWindow(window: BrowserWindow | null | undefined): boolean {
    return Boolean(window && this.overlayWindow && window.id === this.overlayWindow.id)
  }

  async load(): Promise<void> {
    this.settings = await this.readSettings()
    if (this.settings.enabled) this.open()
  }

  async setEnabled(enabled: boolean): Promise<void> {
    if (this.settings.enabled === enabled) {
      if (enabled) this.open()
      return
    }

    this.settings = { ...this.settings, enabled }
    await this.writeSettings()

    if (enabled) {
      this.open()
    } else {
      this.close()
    }
  }

  openAudioSettings(): void {
    this.showMainWindow()
    this.getMainWindow()?.webContents.send(DICTATION_CHANNELS.openAudioSettings)
  }

  private open(): void {
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      this.overlayWindow.showInactive()
      return
    }

    this.overlayWindow = createDictationOverlayWindow({
      appName: this.appName,
      bounds: this.settings.bounds,
      icon: this.icon,
      isDev: this.isDev,
      isSafeExternalUrl: this.isSafeExternalUrl,
      onBoundsChanged: (bounds) => {
        this.settings = { ...this.settings, bounds }
        void this.writeSettings()
      },
      onClosed: () => {
        this.overlayWindow = null
      },
      rendererUrl: this.rendererUrl
    })
  }

  private close(): void {
    if (!this.overlayWindow || this.overlayWindow.isDestroyed()) {
      this.overlayWindow = null
      return
    }

    const windowToClose = this.overlayWindow
    this.overlayWindow = null
    windowToClose.close()
  }

  private getSettingsPath(): string {
    return join(this.getUserDataPath(), 'dictation', 'overlay-settings.json')
  }

  private async readSettings(): Promise<DictationOverlaySettings> {
    try {
      const contents = await readFile(this.getSettingsPath(), 'utf8')
      const value = JSON.parse(contents) as Partial<DictationOverlaySettings>

      return {
        bounds: normalizeBounds(value.bounds),
        enabled: typeof value.enabled === 'boolean' ? value.enabled : false
      }
    } catch {
      return DEFAULT_OVERLAY_SETTINGS
    }
  }

  private async writeSettings(): Promise<void> {
    await mkdir(join(this.getUserDataPath(), 'dictation'), { recursive: true })
    await writeFile(this.getSettingsPath(), JSON.stringify(this.settings, null, 2), 'utf8')
  }
}

function normalizeBounds(value: unknown): Electron.Rectangle | undefined {
  if (!value || typeof value !== 'object') return undefined

  const bounds = value as Partial<Electron.Rectangle>
  if (
    typeof bounds.x !== 'number' ||
    typeof bounds.y !== 'number' ||
    typeof bounds.width !== 'number' ||
    typeof bounds.height !== 'number'
  ) {
    return undefined
  }

  return {
    height: Math.max(72, Math.min(220, bounds.height)),
    width: Math.max(260, Math.min(520, bounds.width)),
    x: bounds.x,
    y: bounds.y
  }
}
