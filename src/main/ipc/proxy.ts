import { ipcMain } from 'electron'
import type { ProxyStatus } from '@shared/types'

export function registerProxyHandlers(): void {
  ipcMain.handle('proxy:get-status', async (): Promise<ProxyStatus> => {
    return {
      providerProxy: {
        port: 3820,
        running: false,
        requestCount: 0
      },
      mcpAggregator: {
        port: 3821,
        running: false,
        connectedClients: 0
      }
    }
  })

  ipcMain.handle('proxy:restart', async (): Promise<void> => {
    // TODO: Implement proxy lifecycle management in Phase 3.
  })
}
