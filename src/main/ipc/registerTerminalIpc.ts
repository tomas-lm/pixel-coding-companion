import { ipcMain } from 'electron'
import {
  TERMINAL_CHANNELS,
  type TerminalInputRequest,
  type TerminalResizeRequest,
  type TerminalSessionId,
  type TerminalStartRequest,
  type TerminalStartResponse
} from '../../shared/terminal'
import type { TerminalManager } from '../terminal/terminalManager'

export function registerTerminalIpc(terminalManager: TerminalManager): void {
  ipcMain.handle(
    TERMINAL_CHANNELS.start,
    async (_event, request: TerminalStartRequest): Promise<TerminalStartResponse> => {
      return terminalManager.start(request)
    }
  )

  ipcMain.handle(TERMINAL_CHANNELS.stop, (_, id: TerminalSessionId) => {
    terminalManager.stop(id)
  })

  ipcMain.on(TERMINAL_CHANNELS.input, (_, request: TerminalInputRequest) => {
    terminalManager.writeInput(request)
  })

  ipcMain.on(TERMINAL_CHANNELS.resize, (_, request: TerminalResizeRequest) => {
    terminalManager.resize(request)
  })
}
