import { contextBridge, ipcRenderer } from 'electron'
import {
  TERMINAL_CHANNELS,
  type CompanionApi,
  type TerminalDataEvent,
  type TerminalExitEvent,
  type TerminalInputRequest,
  type TerminalResizeRequest,
  type TerminalSessionId,
  type TerminalStartRequest,
  type TerminalStartResponse
} from '../shared/terminal'
import { WORKSPACE_CHANNELS, type FolderPickResult } from '../shared/workspace'

const api: CompanionApi = {
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
    }
  },
  workspace: {
    pickFolder: (): Promise<FolderPickResult> => ipcRenderer.invoke(WORKSPACE_CHANNELS.pickFolder)
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
