import { ipcMain } from 'electron'
import type { ProxyStatus } from '@shared/types'
import { logger } from '@main/lib/logger'
import { proxyService } from '@main/proxy/proxy.service'

export function registerProxyHandlers(): void {
  ipcMain.handle('proxy:get-status', async (): Promise<ProxyStatus> => {
    try {
      return proxyService.getStatus()
    } catch (error) {
      logger.error('proxy', 'proxy:get-status failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  })

  ipcMain.handle('proxy:restart', async (): Promise<void> => {
    try {
      await proxyService.restart()
    } catch (error) {
      logger.error('proxy', 'proxy:restart failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  })

  ipcMain.handle('proxy:get-ports', async (): Promise<{ providerPort: number; mcpPort: number }> => {
    try {
      return proxyService.getPorts()
    } catch (error) {
      logger.error('proxy', 'proxy:get-ports failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  })

  ipcMain.handle(
    'proxy:set-ports',
    async (_event, ports: { providerPort: number; mcpPort: number }): Promise<void> => {
      try {
        proxyService.setPorts(ports)
      } catch (error) {
        logger.error('proxy', 'proxy:set-ports failed', {
          error: error instanceof Error ? error.message : 'Unknown error'
        })
        throw error
      }
    }
  )

  ipcMain.handle('proxy:get-connected-clients', async (): Promise<number> => {
    try {
      return proxyService.getStatus().mcpAggregator.connectedClients
    } catch (error) {
      logger.error('proxy', 'proxy:get-connected-clients failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  })
}
