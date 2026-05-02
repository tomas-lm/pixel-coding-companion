import { ipcMain } from 'electron'
import {
  COMPANION_CHANNELS,
  type CompanionBridgeState,
  type CompanionProgressState
} from '../../shared/companion'
import {
  type CompanionBoxOpenRequest,
  type CompanionBoxOpenResult,
  type CompanionSelectRequest,
  type CompanionSelectResult,
  type CompanionStarterSelectRequest,
  type CompanionStarterSelectResult,
  type CompanionStoreState
} from '../../shared/companionStore'
import type { CompanionBridgeStore } from '../companion/companionBridgeStore'
import type { CompanionStoreService } from '../companion/companionStoreService'

export function registerCompanionIpc(
  companionBridgeStore: CompanionBridgeStore,
  companionStoreService: CompanionStoreService
): void {
  ipcMain.handle(COMPANION_CHANNELS.loadBridgeState, async (): Promise<CompanionBridgeState> => {
    return companionBridgeStore.load()
  })

  ipcMain.handle(COMPANION_CHANNELS.loadProgress, async (): Promise<CompanionProgressState> => {
    return companionStoreService.loadProgress()
  })

  ipcMain.handle(COMPANION_CHANNELS.loadStoreState, async (): Promise<CompanionStoreState> => {
    return companionStoreService.loadStoreState()
  })

  ipcMain.handle(
    COMPANION_CHANNELS.openBox,
    async (_, request: CompanionBoxOpenRequest): Promise<CompanionBoxOpenResult> => {
      return companionStoreService.openBox(request)
    }
  )

  ipcMain.handle(
    COMPANION_CHANNELS.selectStarter,
    async (_, request: CompanionStarterSelectRequest): Promise<CompanionStarterSelectResult> => {
      return companionStoreService.selectStarter(request)
    }
  )

  ipcMain.handle(
    COMPANION_CHANNELS.selectCompanion,
    async (_, request: CompanionSelectRequest): Promise<CompanionSelectResult> => {
      return companionStoreService.selectCompanion(request)
    }
  )
}
