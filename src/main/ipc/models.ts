import { ipcMain } from 'electron'
import type { LocalModel, ResourceStats } from '@shared/types'

export function registerModelHandlers(): void {
  ipcMain.handle('models:list', async (): Promise<LocalModel[]> => {
    return []
  })

  ipcMain.handle('models:pull', async (): Promise<void> => {
    // TODO: Implement runtime model pull in Phase 2.
  })

  ipcMain.handle('models:remove', async (): Promise<void> => {
    // TODO: Implement runtime model removal in Phase 2.
  })

  ipcMain.handle('models:load', async (): Promise<void> => {
    // TODO: Implement model load in Phase 2.
  })

  ipcMain.handle('models:unload', async (): Promise<void> => {
    // TODO: Implement model unload in Phase 2.
  })

  ipcMain.handle('models:get-resource-stats', async (): Promise<ResourceStats> => {
    return {
      ramTotalMb: 16000,
      ramUsedMb: 8000,
      vramTotalMb: null,
      vramUsedMb: null,
      cpuPercent: 0
    }
  })

  ipcMain.handle('models:search', async (): Promise<unknown[]> => {
    return []
  })
}
