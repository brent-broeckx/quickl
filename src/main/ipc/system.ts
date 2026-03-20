import { app, ipcMain, shell } from 'electron'

export function registerSystemHandlers(): void {
  ipcMain.handle('system:get-diagnostics', async (): Promise<Record<string, unknown>> => {
    return {}
  })

  ipcMain.handle('system:open-data-directory', async (): Promise<void> => {
    await shell.openPath(app.getPath('userData'))
  })

  ipcMain.handle('system:check-for-updates', async (): Promise<{ available: boolean; version?: string }> => {
    return { available: false }
  })

  ipcMain.handle('system:get-version', async (): Promise<string> => {
    return app.getVersion()
  })
}
