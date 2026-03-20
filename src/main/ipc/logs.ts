import { ipcMain } from 'electron'
import type { LogEntry } from '@shared/types'

export function registerLogHandlers(): void {
  ipcMain.handle('logs:list', async (): Promise<LogEntry[]> => {
    return []
  })

  ipcMain.handle('logs:export', async (): Promise<string> => {
    return '[]'
  })

  ipcMain.handle('logs:clear', async (): Promise<void> => {
    // TODO: Implement log clearing in Phase 9.
  })
}
