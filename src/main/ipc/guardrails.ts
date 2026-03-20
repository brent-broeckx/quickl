import { ipcMain } from 'electron'
import type { GuardrailLogEntry, GuardrailSet } from '@shared/types'

export function registerGuardrailHandlers(): void {
  ipcMain.handle('guardrails:get-set', async (): Promise<GuardrailSet> => {
    return {
      id: 'stub',
      enabled: false,
      rules: [],
      agentExceptions: [],
      explanationMode: 'custom',
      customMessage: null,
      autoGenerateModelId: null
    }
  })

  ipcMain.handle(
    'guardrails:update-set',
    async (_e, _profileId: string, set: Partial<GuardrailSet>): Promise<GuardrailSet> => {
      return {
        id: 'stub',
        enabled: false,
        rules: [],
        agentExceptions: [],
        explanationMode: 'custom',
        customMessage: null,
        autoGenerateModelId: null,
        ...set
      }
    }
  )

  ipcMain.handle('guardrails:add-agent-exception', async (): Promise<void> => {
    // TODO: Implement exception registry in Phase 6.
  })

  ipcMain.handle('guardrails:remove-agent-exception', async (): Promise<void> => {
    // TODO: Implement exception removal in Phase 6.
  })

  ipcMain.handle('guardrails:get-logs', async (): Promise<GuardrailLogEntry[]> => {
    return []
  })

  ipcMain.handle('guardrails:resolve-violation', async (): Promise<void> => {
    // TODO: Implement strike resolution in Phase 6.
  })
}
