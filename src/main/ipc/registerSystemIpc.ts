import { ipcMain } from 'electron'
import { openTarget } from '../openTarget'
import { SYSTEM_CHANNELS, type OpenTargetRequest, type OpenTargetResult } from '../../shared/system'

export function registerSystemIpc(): void {
  ipcMain.handle(
    SYSTEM_CHANNELS.openTarget,
    async (_, request: OpenTargetRequest): Promise<OpenTargetResult> => openTarget(request)
  )
}
