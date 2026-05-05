import { ipcMain } from 'electron'
import { checkCodeEditor } from '../codeEditors'
import { openTarget } from '../openTarget'
import { listChangedFiles } from '../workspaceChanges'
import {
  SYSTEM_CHANNELS,
  type CodeEditorCheckRequest,
  type CodeEditorCheckResult,
  type OpenTargetRequest,
  type OpenTargetResult,
  type WorkspaceChangesRequest,
  type WorkspaceChangesResult
} from '../../shared/system'

export function registerSystemIpc(): void {
  ipcMain.handle(
    SYSTEM_CHANNELS.checkCodeEditor,
    async (_, request: CodeEditorCheckRequest): Promise<CodeEditorCheckResult> =>
      checkCodeEditor(request)
  )
  ipcMain.handle(
    SYSTEM_CHANNELS.listChangedFiles,
    async (_, request: WorkspaceChangesRequest): Promise<WorkspaceChangesResult> =>
      listChangedFiles(request)
  )
  ipcMain.handle(
    SYSTEM_CHANNELS.openTarget,
    async (_, request: OpenTargetRequest): Promise<OpenTargetResult> => openTarget(request)
  )
}
