import { contextBridge, ipcRenderer } from 'electron'
import {
  COMPANION_CHANNELS,
  type CompanionBridgeState,
  type CompanionProgressState
} from '../shared/companion'
import {
  TERMINAL_CHANNELS,
  type CompanionApi,
  type TerminalCommandExitEvent,
  type TerminalDataEvent,
  type TerminalExitEvent,
  type TerminalInputRequest,
  type TerminalResizeRequest,
  type TerminalSessionId,
  type TerminalStartRequest,
  type TerminalStartResponse
} from '../shared/terminal'
import {
  VIEW_CHANNELS,
  WORKSPACE_CHANNELS,
  type FolderPickResult,
  type WorkspaceConfig
} from '../shared/workspace'

const api: CompanionApi = {
  companion: {
    loadBridgeState: (): Promise<CompanionBridgeState> =>
      ipcRenderer.invoke(COMPANION_CHANNELS.loadBridgeState),
    loadProgress: (): Promise<CompanionProgressState> =>
      ipcRenderer.invoke(COMPANION_CHANNELS.loadProgress)
  },
  terminal: {
    start: (request: TerminalStartRequest): Promise<TerminalStartResponse> =>
      ipcRenderer.invoke(TERMINAL_CHANNELS.start, request),
    stop: (id: TerminalSessionId): Promise<void> => ipcRenderer.invoke(TERMINAL_CHANNELS.stop, id),
    write: (request: TerminalInputRequest): void => {
      ipcRenderer.send(TERMINAL_CHANNELS.input, request)
    },
    resize: (request: TerminalResizeRequest): void => {
      ipcRenderer.send(TERMINAL_CHANNELS.resize, request)
    },
    onData: (callback: (event: TerminalDataEvent) => void) => {
      const listener = (_: Electron.IpcRendererEvent, event: TerminalDataEvent): void =>
        callback(event)
      ipcRenderer.on(TERMINAL_CHANNELS.data, listener)
      return () => ipcRenderer.removeListener(TERMINAL_CHANNELS.data, listener)
    },
    onExit: (callback: (event: TerminalExitEvent) => void) => {
      const listener = (_: Electron.IpcRendererEvent, event: TerminalExitEvent): void =>
        callback(event)
      ipcRenderer.on(TERMINAL_CHANNELS.exit, listener)
      return () => ipcRenderer.removeListener(TERMINAL_CHANNELS.exit, listener)
    },
    onCommandExit: (callback: (event: TerminalCommandExitEvent) => void) => {
      const listener = (_: Electron.IpcRendererEvent, event: TerminalCommandExitEvent): void =>
        callback(event)
      ipcRenderer.on(TERMINAL_CHANNELS.commandExit, listener)
      return () => ipcRenderer.removeListener(TERMINAL_CHANNELS.commandExit, listener)
    }
  },
  workspace: {
    pickFolder: (): Promise<FolderPickResult> => ipcRenderer.invoke(WORKSPACE_CHANNELS.pickFolder),
    loadConfig: (): Promise<WorkspaceConfig | null> =>
      ipcRenderer.invoke(WORKSPACE_CHANNELS.loadConfig),
    saveConfig: (config: WorkspaceConfig): Promise<void> =>
      ipcRenderer.invoke(WORKSPACE_CHANNELS.saveConfig, config)
  },
  view: {
    onResetLayout: (callback: () => void) => {
      const listener = (): void => callback()
      ipcRenderer.on(VIEW_CHANNELS.resetLayout, listener)
      return () => ipcRenderer.removeListener(VIEW_CHANNELS.resetLayout, listener)
    }
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-expect-error api is defined in the isolated preload context.
  window.api = api
}
