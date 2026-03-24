import { ipcMain } from 'electron'
import type { ConfigDiff, IDE, IDEBackup } from '@shared/types'
import { ideService } from '@main/services/ide.service'

export function registerIDEHandlers(): void {
  ipcMain.handle('ides:list', async (): Promise<IDE[]> => {
    return ideService.list()
  })

  ipcMain.handle('ides:scan', async (): Promise<IDE[]> => {
    return ideService.scan()
  })

  ipcMain.handle('ides:configure', async (_event, ideId: string, providerId: string): Promise<ConfigDiff> => {
    return ideService.configure(ideId, providerId)
  })

  ipcMain.handle('ides:apply-config', async (_event, ideId: string, diff: ConfigDiff): Promise<void> => {
    await ideService.applyConfig(ideId, diff)
  })

  ipcMain.handle('ides:reset-config', async (_event, ideId: string): Promise<void> => {
    await ideService.resetConfig(ideId)
  })

  ipcMain.handle('ides:list-backups', async (_event, ideId: string): Promise<IDEBackup[]> => {
    return ideService.listBackups(ideId)
  })

  ipcMain.handle('ides:restore-backup', async (_event, ideId: string, backupPath: string): Promise<void> => {
    await ideService.restoreBackup(ideId, backupPath)
  })
}
