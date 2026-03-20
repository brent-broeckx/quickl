import { ipcMain } from 'electron'
import type { AddProviderInput, Provider } from '@shared/types'

export function registerProviderHandlers(): void {
  ipcMain.handle('providers:list', async (): Promise<Provider[]> => {
    return []
  })

  ipcMain.handle('providers:add', async (_e, config: AddProviderInput): Promise<Provider> => {
    return {
      id: 'stub',
      name: config.name || 'Stub Provider',
      type: 'cloud',
      baseUrl: '',
      authType: 'api-key',
      keychainKey: null,
      enabled: true,
      defaultModel: null,
      status: 'unknown',
      lastLatencyMs: null,
      createdAt: new Date().toISOString()
    }
  })

  ipcMain.handle(
    'providers:update',
    async (_e, id: string, config: Partial<Provider>): Promise<Provider> => {
      return {
        id,
        name: 'Stub',
        type: 'cloud',
        baseUrl: '',
        authType: 'api-key',
        keychainKey: null,
        enabled: true,
        defaultModel: null,
        status: 'unknown',
        lastLatencyMs: null,
        createdAt: new Date().toISOString(),
        ...config
      }
    }
  )

  ipcMain.handle('providers:remove', async (): Promise<void> => {
    // TODO: Implement provider removal in Phase 1.
  })

  ipcMain.handle(
    'providers:test-connection',
    async (): Promise<{ ok: boolean; latencyMs: number; error?: string }> => {
      return { ok: true, latencyMs: 0 }
    }
  )

  ipcMain.handle('providers:list-models', async (): Promise<string[]> => {
    return []
  })

  ipcMain.handle('providers:set-api-key', async (): Promise<void> => {
    // TODO: Implement keytar-backed key storage in Phase 1.
  })

  ipcMain.handle('providers:get-api-key-hint', async (): Promise<string> => {
    return 'sk-...xxxx'
  })
}
