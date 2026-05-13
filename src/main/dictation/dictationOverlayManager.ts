import { BrowserWindow, screen } from 'electron'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { DICTATION_CHANNELS, type DictationOverlayMoveRequest } from '../../shared/dictation'
import { createDictationOverlayWindow } from '../window/createDictationOverlayWindow'

type DictationOverlaySettings = {
  anchor?: DictationOverlayAnchor
  bounds?: Electron.Rectangle
  enabled: boolean
}

type DictationOverlayAnchor = {
  horizontal: 'left' | 'right'
  vertical: 'bottom' | 'top'
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
const COLLAPSED_OVERLAY_SIZE = { height: 42, width: 42 }
const EXPANDED_OVERLAY_SIZE = { height: 42, width: 142 }
const OVERLAY_EDGE_MARGIN = 14

export class DictationOverlayManager {
  private readonly appName: string
  private readonly getMainWindow: () => BrowserWindow | null
  private readonly getUserDataPath: () => string
  private readonly icon: string
  private readonly isDev: boolean
  private readonly isSafeExternalUrl: (url: string) => boolean
  private readonly rendererUrl?: string
  private readonly showMainWindow: () => void
  private collapsedBoundsBeforeExpansion: Electron.Rectangle | null = null
  private expanded = false
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
    if (this.settings.enabled) {
      this.open()
    }
  }

  async setEnabled(enabled: boolean): Promise<void> {
    if (this.settings.enabled === enabled) {
      if (enabled) {
        this.open()
      }
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

  openMainWindow(): void {
    this.showMainWindow()
  }

  presentOnActiveDisplay(): void {
    if (!this.settings.enabled) return

    this.open()
    if (!this.overlayWindow || this.overlayWindow.isDestroyed()) return

    const activeDisplay = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
    this.overlayWindow.setBounds(this.getAnchoredBounds(activeDisplay.workArea), false)

    this.showOverlayInactive()
  }

  moveBy({ deltaX, deltaY }: DictationOverlayMoveRequest): void {
    if (!this.overlayWindow || this.overlayWindow.isDestroyed()) return
    if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY)) return

    const currentBounds = this.overlayWindow.getBounds()
    const nextBounds = this.keepBoundsInWorkArea({
      ...currentBounds,
      x: currentBounds.x + Math.round(deltaX),
      y: currentBounds.y + Math.round(deltaY)
    })
    this.overlayWindow.setBounds(nextBounds, false)
  }

  finishDrag(): void {
    if (!this.overlayWindow || this.overlayWindow.isDestroyed()) return

    const snappedBounds = this.getNearestCornerBounds(this.overlayWindow.getBounds())
    this.overlayWindow.setBounds(snappedBounds, false)
    this.storeCollapsedBounds(snappedBounds)
  }

  setExpanded(expanded: boolean): void {
    if (!this.overlayWindow || this.overlayWindow.isDestroyed()) return

    const currentBounds = this.overlayWindow.getBounds()
    if (expanded) {
      this.collapsedBoundsBeforeExpansion = {
        ...currentBounds,
        ...COLLAPSED_OVERLAY_SIZE
      }
    }

    const nextBounds = expanded
      ? this.getExpandedBounds(currentBounds)
      : (this.collapsedBoundsBeforeExpansion ?? {
          ...currentBounds,
          ...COLLAPSED_OVERLAY_SIZE
        })
    this.expanded = expanded
    this.overlayWindow.setBounds(nextBounds, true)
    if (!expanded) this.collapsedBoundsBeforeExpansion = null
    this.showOverlayInactive()
  }

  private open(): void {
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      this.showOverlayInactive()
      return
    }

    this.overlayWindow = createDictationOverlayWindow({
      appName: this.appName,
      bounds: this.settings.bounds,
      icon: this.icon,
      isDev: this.isDev,
      isSafeExternalUrl: this.isSafeExternalUrl,
      onBoundsChanged: (bounds) => {
        if (this.expanded) return

        this.storeCollapsedBounds(bounds)
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

  private keepBoundsInWorkArea(bounds: Electron.Rectangle): Electron.Rectangle {
    const display = screen.getDisplayMatching(bounds)
    const workArea = display.workArea
    const maxX = workArea.x + workArea.width - bounds.width
    const maxY = workArea.y + workArea.height - bounds.height

    return {
      ...bounds,
      x: Math.min(Math.max(bounds.x, workArea.x), Math.max(workArea.x, maxX)),
      y: Math.min(Math.max(bounds.y, workArea.y), Math.max(workArea.y, maxY))
    }
  }

  private getAnchoredBounds(workArea: Electron.Rectangle): Electron.Rectangle {
    const anchor = this.settings.anchor ?? {
      horizontal: 'right',
      vertical: 'bottom'
    }

    return this.getBoundsForAnchor(workArea, anchor)
  }

  private getNearestCornerBounds(bounds: Electron.Rectangle): Electron.Rectangle {
    const display = screen.getDisplayMatching(bounds)
    const workArea = display.workArea
    const anchor = getNearestCornerAnchor(bounds, workArea)

    return this.getBoundsForAnchor(workArea, anchor)
  }

  private getBoundsForAnchor(
    workArea: Electron.Rectangle,
    anchor: DictationOverlayAnchor
  ): Electron.Rectangle {
    return {
      ...COLLAPSED_OVERLAY_SIZE,
      x:
        anchor.horizontal === 'left'
          ? workArea.x + OVERLAY_EDGE_MARGIN
          : workArea.x + workArea.width - COLLAPSED_OVERLAY_SIZE.width - OVERLAY_EDGE_MARGIN,
      y:
        anchor.vertical === 'top'
          ? workArea.y + OVERLAY_EDGE_MARGIN
          : workArea.y + workArea.height - COLLAPSED_OVERLAY_SIZE.height - OVERLAY_EDGE_MARGIN
    }
  }

  private getExpandedBounds(bounds: Electron.Rectangle): Electron.Rectangle {
    const display = screen.getDisplayMatching(bounds)
    const workArea = display.workArea
    const compactCenterX = bounds.x + bounds.width / 2
    const compactCenterY = bounds.y + bounds.height / 2
    const anchorRight = compactCenterX >= workArea.x + workArea.width / 2
    const anchorBottom = compactCenterY >= workArea.y + workArea.height / 2

    return this.keepBoundsInWorkArea({
      ...EXPANDED_OVERLAY_SIZE,
      x: anchorRight ? bounds.x + bounds.width - EXPANDED_OVERLAY_SIZE.width : bounds.x,
      y: anchorBottom ? bounds.y + bounds.height - EXPANDED_OVERLAY_SIZE.height : bounds.y
    })
  }

  private showOverlayInactive(): void {
    if (!this.overlayWindow || this.overlayWindow.isDestroyed()) return

    this.overlayWindow.setAlwaysOnTop(true, 'screen-saver', 1)
    if (!this.overlayWindow.isVisible()) this.overlayWindow.showInactive()
  }

  private storeCollapsedBounds(bounds: Electron.Rectangle): void {
    const collapsedBounds = {
      ...bounds,
      ...COLLAPSED_OVERLAY_SIZE
    }
    const display = screen.getDisplayMatching(collapsedBounds)

    this.settings = {
      ...this.settings,
      anchor: getNearestCornerAnchor(collapsedBounds, display.workArea),
      bounds: collapsedBounds
    }
    void this.writeSettings()
  }

  private getSettingsPath(): string {
    return join(this.getUserDataPath(), 'dictation', 'overlay-settings.json')
  }

  private async readSettings(): Promise<DictationOverlaySettings> {
    try {
      const contents = await readFile(this.getSettingsPath(), 'utf8')
      const value = JSON.parse(contents) as Partial<DictationOverlaySettings>
      const bounds = normalizeBounds(value.bounds)

      return {
        anchor:
          normalizeAnchor(value.anchor) ??
          (bounds
            ? getNearestCornerAnchor(bounds, screen.getDisplayMatching(bounds).workArea)
            : undefined),
        bounds,
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

function getNearestCornerAnchor(
  bounds: Electron.Rectangle,
  workArea: Electron.Rectangle
): DictationOverlayAnchor {
  const centerX = bounds.x + bounds.width / 2
  const centerY = bounds.y + bounds.height / 2

  return {
    horizontal: centerX < workArea.x + workArea.width / 2 ? 'left' : 'right',
    vertical: centerY < workArea.y + workArea.height / 2 ? 'top' : 'bottom'
  }
}

function normalizeAnchor(value: unknown): DictationOverlayAnchor | undefined {
  if (!value || typeof value !== 'object') return undefined

  const anchor = value as Partial<DictationOverlayAnchor>
  if (
    (anchor.horizontal !== 'left' && anchor.horizontal !== 'right') ||
    (anchor.vertical !== 'bottom' && anchor.vertical !== 'top')
  ) {
    return undefined
  }

  return {
    horizontal: anchor.horizontal,
    vertical: anchor.vertical
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
    height: COLLAPSED_OVERLAY_SIZE.height,
    width: COLLAPSED_OVERLAY_SIZE.width,
    x: bounds.x,
    y: bounds.y
  }
}
