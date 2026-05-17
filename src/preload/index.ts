import { clipboard, contextBridge, ipcRenderer } from 'electron'
import {
  COMPANION_CHANNELS,
  type CompanionBridgeState,
  type CompanionProgressState
} from '../shared/companion'
import {
  SYSTEM_CHANNELS,
  type CodeEditorCheckRequest,
  type CodeEditorCheckResult,
  type OpenTargetRequest,
  type OpenTargetResult,
  type WorkspaceChangesRequest,
  type WorkspaceChangesResult
} from '../shared/system'
import {
  DICTATION_CHANNELS,
  type DictationExternalInsertRequest,
  type DictationExternalInsertResult,
  type DictationCaptureCommand,
  type DictationCaptureResult,
  type DictationHistoryDeleteRequest,
  type DictationHistoryListRequest,
  type DictationHistoryListResult,
  type DictationInsertRequest,
  type DictationInsertionResult,
  type DictationMicrophonePermissionSnapshot,
  type DictationOverlayMoveRequest,
  type DictationSettings,
  type DictationSnapshot,
  type DictationStatsSnapshot
} from '../shared/dictation'
import {
  TERMINAL_CHANNELS,
  type CompanionApi,
  type TerminalCommandExitEvent,
  type TerminalContextEvent,
  type TerminalDataEvent,
  type TerminalExitEvent,
  type TerminalInputRequest,
  type TerminalResizeRequest,
  type TerminalSessionId,
  type TerminalStartRequest,
  type TerminalStartResponse
} from '../shared/terminal'
import {
  VAULT_CHANNELS,
  type VaultCreateDirectoryRequest,
  type VaultCreateFolderRequest,
  type VaultCreateMarkdownFileRequest,
  type VaultDeleteEntryRequest,
  type VaultFileRequest,
  type VaultRootRequest,
  type VaultSaveMarkdownFileRequest
} from '../shared/vault'
import {
  VIEW_CHANNELS,
  WORKSPACE_CHANNELS,
  type FolderPickResult,
  type PickFolderOptions,
  type WorkspaceConfig
} from '../shared/workspace'

function normalizeDictationCaptureResult(
  result: DictationCaptureResult | string
): DictationCaptureResult {
  if (typeof result === 'string') {
    return JSON.parse(result) as DictationCaptureResult
  }

  if (!result.ok) {
    return {
      ok: false,
      reason: result.reason
    }
  }

  return {
    audioBase64: result.audioBase64,
    mimeType: result.mimeType,
    ok: true,
    sampleRate: result.sampleRate,
    ...(result.audioData instanceof ArrayBuffer ? { audioData: result.audioData } : {})
  }
}

const api: CompanionApi = {
  companion: {
    loadBridgeState: (): Promise<CompanionBridgeState> =>
      ipcRenderer.invoke(COMPANION_CHANNELS.loadBridgeState),
    loadProgress: (): Promise<CompanionProgressState> =>
      ipcRenderer.invoke(COMPANION_CHANNELS.loadProgress),
    loadStoreState: () => ipcRenderer.invoke(COMPANION_CHANNELS.loadStoreState),
    openBox: (request) => ipcRenderer.invoke(COMPANION_CHANNELS.openBox, request),
    selectCompanion: (request) => ipcRenderer.invoke(COMPANION_CHANNELS.selectCompanion, request),
    selectStarter: (request) => ipcRenderer.invoke(COMPANION_CHANNELS.selectStarter, request)
  },
  clipboard: {
    writeText: (text: string): void => {
      clipboard.writeText(text)
    }
  },
  dictation: {
    clearHistory: (): Promise<DictationHistoryListResult> =>
      ipcRenderer.invoke(DICTATION_CHANNELS.clearHistory),
    completeCapture: (result: DictationCaptureResult | string): Promise<DictationSnapshot> =>
      ipcRenderer.invoke(
        DICTATION_CHANNELS.completeCapture,
        normalizeDictationCaptureResult(result)
      ),
    completeInsertion: (result: DictationInsertionResult): void => {
      ipcRenderer.send(DICTATION_CHANNELS.completeInsertion, result)
    },
    deleteHistoryEntry: (
      request: DictationHistoryDeleteRequest
    ): Promise<DictationHistoryListResult> =>
      ipcRenderer.invoke(DICTATION_CHANNELS.deleteHistoryEntry, request),
    getMicrophonePermission: (): Promise<DictationMicrophonePermissionSnapshot> =>
      ipcRenderer.invoke(DICTATION_CHANNELS.getMicrophonePermission),
    installModel: (): Promise<DictationSnapshot> =>
      ipcRenderer.invoke(DICTATION_CHANNELS.installModel),
    insertExternalText: (
      request: DictationExternalInsertRequest
    ): Promise<DictationExternalInsertResult> =>
      ipcRenderer.invoke(DICTATION_CHANNELS.insertExternalText, request),
    listHistory: (request?: DictationHistoryListRequest): Promise<DictationHistoryListResult> =>
      ipcRenderer.invoke(DICTATION_CHANNELS.listHistory, request),
    loadStats: (): Promise<DictationStatsSnapshot> =>
      ipcRenderer.invoke(DICTATION_CHANNELS.loadStats),
    loadSnapshot: (): Promise<DictationSnapshot> =>
      ipcRenderer.invoke(DICTATION_CHANNELS.loadSnapshot),
    finishOverlayDrag: (): void => {
      ipcRenderer.send(DICTATION_CHANNELS.finishOverlayDrag)
    },
    moveOverlay: (request: DictationOverlayMoveRequest): void => {
      ipcRenderer.send(DICTATION_CHANNELS.moveOverlay, request)
    },
    onCaptureCommand: (callback: (command: DictationCaptureCommand) => void) => {
      const listener = (_: Electron.IpcRendererEvent, command: DictationCaptureCommand): void =>
        callback(command)
      ipcRenderer.on(DICTATION_CHANNELS.captureCommand, listener)
      return () => ipcRenderer.removeListener(DICTATION_CHANNELS.captureCommand, listener)
    },
    onInsertTranscript: (callback: (request: DictationInsertRequest) => void) => {
      const listener = (_: Electron.IpcRendererEvent, request: DictationInsertRequest): void =>
        callback(request)
      ipcRenderer.on(DICTATION_CHANNELS.insertTranscript, listener)
      return () => ipcRenderer.removeListener(DICTATION_CHANNELS.insertTranscript, listener)
    },
    onOpenAudioSettings: (callback: () => void) => {
      const listener = (): void => callback()
      ipcRenderer.on(DICTATION_CHANNELS.openAudioSettings, listener)
      return () => ipcRenderer.removeListener(DICTATION_CHANNELS.openAudioSettings, listener)
    },
    onState: (callback: (snapshot: DictationSnapshot) => void) => {
      const listener = (_: Electron.IpcRendererEvent, snapshot: DictationSnapshot): void =>
        callback(snapshot)
      ipcRenderer.on(DICTATION_CHANNELS.state, listener)
      return () => ipcRenderer.removeListener(DICTATION_CHANNELS.state, listener)
    },
    openAudioSettings: (): void => {
      ipcRenderer.send(DICTATION_CHANNELS.openAudioSettings)
    },
    openMainWindow: (): void => {
      ipcRenderer.send(DICTATION_CHANNELS.openMainWindow)
    },
    openMicrophoneSettings: (): void => {
      ipcRenderer.send(DICTATION_CHANNELS.openMicrophoneSettings)
    },
    requestMicrophonePermission: (): Promise<DictationMicrophonePermissionSnapshot> =>
      ipcRenderer.invoke(DICTATION_CHANNELS.requestMicrophonePermission),
    setOverlayExpanded: (expanded: boolean): void => {
      ipcRenderer.send(DICTATION_CHANNELS.setOverlayExpanded, expanded)
    },
    testTranscription: (): Promise<DictationSnapshot> =>
      ipcRenderer.invoke(DICTATION_CHANNELS.testTranscription),
    toggleRecording: (): Promise<DictationSnapshot> =>
      ipcRenderer.invoke(DICTATION_CHANNELS.toggleRecording),
    updateSettings: (settings: DictationSettings): Promise<DictationSnapshot> =>
      ipcRenderer.invoke(DICTATION_CHANNELS.updateSettings, settings)
  },
  system: {
    checkCodeEditor: (request: CodeEditorCheckRequest): Promise<CodeEditorCheckResult> =>
      ipcRenderer.invoke(SYSTEM_CHANNELS.checkCodeEditor, request),
    listChangedFiles: (request: WorkspaceChangesRequest): Promise<WorkspaceChangesResult> =>
      ipcRenderer.invoke(SYSTEM_CHANNELS.listChangedFiles, request),
    openTarget: (request: OpenTargetRequest): Promise<OpenTargetResult> =>
      ipcRenderer.invoke(SYSTEM_CHANNELS.openTarget, request)
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
    },
    onContext: (callback: (event: TerminalContextEvent) => void) => {
      const listener = (_: Electron.IpcRendererEvent, event: TerminalContextEvent): void =>
        callback(event)
      ipcRenderer.on(TERMINAL_CHANNELS.context, listener)
      return () => ipcRenderer.removeListener(TERMINAL_CHANNELS.context, listener)
    }
  },
  vault: {
    createFolder: (request: VaultCreateDirectoryRequest) =>
      ipcRenderer.invoke(VAULT_CHANNELS.createFolder, request),
    createMarkdownFile: (request: VaultCreateMarkdownFileRequest) =>
      ipcRenderer.invoke(VAULT_CHANNELS.createMarkdownFile, request),
    createVaultFolder: (request: VaultCreateFolderRequest) =>
      ipcRenderer.invoke(VAULT_CHANNELS.createVaultFolder, request),
    deleteEntry: (request: VaultDeleteEntryRequest) =>
      ipcRenderer.invoke(VAULT_CHANNELS.deleteEntry, request),
    listTree: (request: VaultRootRequest) => ipcRenderer.invoke(VAULT_CHANNELS.listTree, request),
    pickFolder: () => ipcRenderer.invoke(VAULT_CHANNELS.pickFolder),
    pickParentFolder: () => ipcRenderer.invoke(VAULT_CHANNELS.pickParentFolder),
    readMarkdownFile: (request: VaultFileRequest) =>
      ipcRenderer.invoke(VAULT_CHANNELS.readMarkdownFile, request),
    saveMarkdownFile: (request: VaultSaveMarkdownFileRequest) =>
      ipcRenderer.invoke(VAULT_CHANNELS.saveMarkdownFile, request)
  },
  workspace: {
    pickFolder: (options?: PickFolderOptions): Promise<FolderPickResult> =>
      ipcRenderer.invoke(WORKSPACE_CHANNELS.pickFolder, options),
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
