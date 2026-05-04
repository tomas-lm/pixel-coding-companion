import { type BrowserWindow, type BrowserWindowConstructorOptions } from 'electron'

export type PlatformWindowConfig = {
  windowOptions: Pick<BrowserWindowConstructorOptions, 'autoHideMenuBar'>
  applyAfterCreate?: (window: BrowserWindow) => void
}

export function getLinuxWindowConfig(): PlatformWindowConfig {
  return {
    windowOptions: {
      autoHideMenuBar: true
    },
    applyAfterCreate: (window) => {
      window.setMenuBarVisibility(false)
    }
  }
}

export function getMacWindowConfig(): PlatformWindowConfig {
  return {
    windowOptions: {
      autoHideMenuBar: false
    }
  }
}

export function getDefaultWindowConfig(): PlatformWindowConfig {
  return {
    windowOptions: {
      autoHideMenuBar: true
    },
    applyAfterCreate: (window) => {
      window.setMenuBarVisibility(false)
    }
  }
}

export function getPlatformWindowConfig(): PlatformWindowConfig {
  if (process.platform === 'linux') return getLinuxWindowConfig()
  if (process.platform === 'darwin') return getMacWindowConfig()
  return getDefaultWindowConfig()
}
