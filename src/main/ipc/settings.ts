import { ipcMain } from 'electron'
import { store } from '@main/lib/store'

export function registerSettingsHandlers(): void {
  ipcMain.handle('settings:get-theme', async (): Promise<'light' | 'dark' | 'system'> => {
    return store.get('settings.theme')
  })

  ipcMain.handle(
    'settings:set-theme',
    async (_e, theme: 'light' | 'dark' | 'system'): Promise<void> => {
      store.set('settings.theme', theme)
    }
  )
}
