import { BrowserWindow, ipcMain, type IpcMainInvokeEvent } from 'electron'
import type { LocalModel, ModelPullProgress, OllamaRegistryModel, ResourceStats } from '@shared/types'
import { logger } from '@main/lib/logger'
import { modelService } from '@main/services/model.service'
import { resourceMonitor } from '@main/services/resource-monitor'
import { daemonManager } from '@main/services/daemon-manager'

function mapCommonError(error: unknown): Error {
  if (!(error instanceof Error)) {
    return new Error('Unexpected model operation error')
  }

  const code = (error as Error & { code?: string }).code
  if (code === 'ECONNREFUSED') {
    return new Error('Could not connect to Ollama')
  }

  if (/404|not found/i.test(error.message)) {
    return new Error('Model not found')
  }

  if (/timed out|timeout|aborted/i.test(error.message)) {
    return new Error('Request timed out')
  }

  return error
}

export function registerModelHandlers(): void {
  ipcMain.handle('models:list', async (): Promise<LocalModel[]> => {
    try {
      return await modelService.listInstalled()
    } catch (error) {
      logger.error('model', 'models:list failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw mapCommonError(error)
    }
  })

  ipcMain.handle('models:pull', async (_event, name: string): Promise<void> => {
    void modelService.pull(name).catch((error) => {
      const mapped = mapCommonError(error)
      logger.error('model', 'models:pull failed', {
        name,
        error: mapped.message
      })

      const progress: ModelPullProgress = {
        name,
        status: 'error',
        progress: 0,
        completed: null,
        total: null
      }

      for (const window of BrowserWindow.getAllWindows()) {
        window.webContents.send('quickl:model-pull-progress', progress)
      }
    })
  })

  ipcMain.handle('models:remove', async (_event, runtime: string, name: string): Promise<void> => {
    try {
      await modelService.delete(runtime, name)
    } catch (error) {
      logger.error('model', 'models:remove failed', {
        runtime,
        name,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw mapCommonError(error)
    }
  })

  ipcMain.handle('models:load', async (_event, name: string): Promise<void> => {
    try {
      await modelService.load(name)
    } catch (error) {
      logger.error('model', 'models:load failed', {
        name,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw mapCommonError(error)
    }
  })

  ipcMain.handle('models:unload', async (_event, name: string): Promise<void> => {
    try {
      await modelService.unload(name)
    } catch (error) {
      logger.error('model', 'models:unload failed', {
        name,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw mapCommonError(error)
    }
  })

  ipcMain.handle('models:getStats', async (): Promise<ResourceStats> => {
    return await resourceMonitor.getStats()
  })

  ipcMain.handle('models:search', async (_event, query: string): Promise<OllamaRegistryModel[]> => {
    try {
      return await modelService.searchRegistry(query)
    } catch (error) {
      logger.error('model', 'models:search failed', {
        query,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw mapCommonError(error)
    }
  })

  ipcMain.handle('models:getTags', async (_event, modelId: string): Promise<string[]> => {
    return await modelService.getTags(modelId)
  })

  ipcMain.handle('models:addTag', async (_event, modelId: string, tag: string): Promise<string[]> => {
    return await modelService.addTag(modelId, tag)
  })

  ipcMain.handle('models:removeTag', async (_event, modelId: string, tag: string): Promise<string[]> => {
    return await modelService.removeTag(modelId, tag)
  })

  ipcMain.handle('resource-monitor:start', async (event: IpcMainInvokeEvent): Promise<void> => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (window) {
      resourceMonitor.startPolling(window)
    }
  })

  ipcMain.handle('resource-monitor:stop', async (): Promise<void> => {
    resourceMonitor.stopPolling()
  })

  ipcMain.handle('daemon:ollamaStatus', async (): Promise<'running' | 'stopped' | 'not-installed'> => {
    return await daemonManager.getOllamaStatus()
  })

  ipcMain.handle('daemon:startOllama', async (): Promise<void> => {
    try {
      await daemonManager.startOllama()
    } catch (error) {
      throw mapCommonError(error)
    }
  })
}
