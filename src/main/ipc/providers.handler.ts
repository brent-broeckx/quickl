import { ipcMain } from 'electron'
import type { AddProviderInput, Provider } from '@shared/types'
import { logger } from '@main/lib/logger'
import { providerService } from '@main/services/provider.service'

export function registerProviderHandlers(): void {
  ipcMain.handle('providers:list', async (): Promise<Provider[]> => {
    try {
      return await providerService.list()
    } catch (error) {
      logger.error('provider', 'providers:list failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  })

  ipcMain.handle('providers:add', async (_event, config: AddProviderInput): Promise<Provider> => {
    try {
      return await providerService.add(config)
    } catch (error) {
      logger.error('provider', 'providers:add failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  })

  ipcMain.handle('providers:update', async (_event, id: string, config: Partial<Provider>): Promise<Provider> => {
    try {
      return await providerService.update(id, config)
    } catch (error) {
      logger.error('provider', 'providers:update failed', {
        id,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  })

  ipcMain.handle('providers:remove', async (_event, id: string): Promise<void> => {
    try {
      await providerService.remove(id)
    } catch (error) {
      logger.error('provider', 'providers:remove failed', {
        id,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  })

  ipcMain.handle('providers:test-connection', async (_event, id: string): Promise<{ ok: boolean; latencyMs: number; error?: string }> => {
    try {
      return await providerService.testConnection(id)
    } catch (error) {
      logger.error('provider', 'providers:test-connection failed', {
        id,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  })

  ipcMain.handle('providers:list-models', async (_event, id: string): Promise<string[]> => {
    try {
      return await providerService.fetchModels(id)
    } catch (error) {
      logger.error('provider', 'providers:list-models failed', {
        id,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  })

  ipcMain.handle('providers:set-api-key', async (_event, id: string, key: string): Promise<void> => {
    try {
      await providerService.setApiKey(id, key)
    } catch (error) {
      logger.error('provider', 'providers:set-api-key failed', {
        id,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  })

  ipcMain.handle('providers:get-api-key-hint', async (_event, id: string): Promise<string> => {
    try {
      return await providerService.getApiKeyHint(id)
    } catch (error) {
      logger.error('provider', 'providers:get-api-key-hint failed', {
        id,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  })
}
