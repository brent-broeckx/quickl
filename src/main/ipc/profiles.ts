import { ipcMain } from 'electron'
import type { Profile, ProfileConfig } from '@shared/types'

export function registerProfileHandlers(): void {
  ipcMain.handle('profiles:list', async (): Promise<Profile[]> => {
    return []
  })

  ipcMain.handle('profiles:create', async (_e, name: string, config: ProfileConfig): Promise<Profile> => {
    return {
      id: 'stub',
      name,
      defaultProviderId: '',
      ideConfigs: {},
      mcpAutoStart: [],
      guardrailSet: {
        id: 'stub',
        enabled: false,
        rules: [],
        agentExceptions: [],
        explanationMode: 'custom',
        customMessage: null,
        autoGenerateModelId: null
      },
      isActive: false,
      createdAt: new Date().toISOString(),
      ...config
    }
  })

  ipcMain.handle('profiles:activate', async (): Promise<void> => {
    // TODO: Implement profile activation in Phase 8.
  })

  ipcMain.handle('profiles:remove', async (): Promise<void> => {
    // TODO: Implement profile deletion in Phase 8.
  })

  ipcMain.handle('profiles:export', async (): Promise<string> => {
    return JSON.stringify({})
  })

  ipcMain.handle('profiles:import', async (): Promise<Profile> => {
    return {
      id: 'stub',
      name: 'Imported',
      defaultProviderId: '',
      ideConfigs: {},
      mcpAutoStart: [],
      guardrailSet: {
        id: 'stub',
        enabled: false,
        rules: [],
        agentExceptions: [],
        explanationMode: 'custom',
        customMessage: null,
        autoGenerateModelId: null
      },
      isActive: false,
      createdAt: new Date().toISOString()
    }
  })
}
