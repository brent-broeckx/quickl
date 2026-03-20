import { ipcMain } from 'electron'
import type { ConfigDiff, IDE } from '@shared/types'

export function registerIDEHandlers(): void {
  ipcMain.handle('ides:list', async (): Promise<IDE[]> => {
    return []
  })

  ipcMain.handle('ides:scan', async (): Promise<IDE[]> => {
    return []
  })

  ipcMain.handle('ides:configure', async (): Promise<ConfigDiff> => {
    return {
      before: '{}',
      after: '{}',
      filePath: '/stub/config'
    }
  })

  ipcMain.handle('ides:apply-config', async (): Promise<void> => {
    // TODO: Implement config patching and atomic writes in Phase 4.
  })

  ipcMain.handle('ides:reset-config', async (): Promise<void> => {
    // TODO: Implement config reset in Phase 4.
  })
}
