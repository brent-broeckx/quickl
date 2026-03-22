import { create } from 'zustand'
import type { LocalModel, ModelPullProgress, ResourceStats } from '@shared/types'

type OllamaStatus = 'running' | 'stopped' | 'not-installed' | 'unknown'

interface ModelsState {
  models: LocalModel[]
  resourceStats: ResourceStats | null
  pullProgress: Record<string, ModelPullProgress>
  activityEvents: Array<{ id: string; timestamp: string; message: string }>
  ollamaStatus: OllamaStatus
  loading: boolean
  error: string | null
  pushActivity: (message: string) => void
  fetchModels: () => Promise<void>
  pullModel: (name: string) => Promise<void>
  deleteModel: (runtime: string, name: string) => Promise<void>
  loadModel: (name: string) => Promise<void>
  unloadModel: (name: string) => Promise<void>
  updateResourceStats: (stats: ResourceStats) => void
  updatePullProgress: (progress: ModelPullProgress) => void
  updateModelStatus: (name: string, status: LocalModel['status']) => void
  checkOllamaStatus: () => Promise<void>
  startOllama: () => Promise<void>
  startResourceMonitor: () => Promise<void>
  stopResourceMonitor: () => Promise<void>
  addTag: (modelId: string, tag: string) => Promise<void>
  removeTag: (modelId: string, tag: string) => Promise<void>
}

export const useModelsStore = create<ModelsState>((set, get) => ({
  models: [],
  resourceStats: null,
  pullProgress: {},
  activityEvents: [],
  ollamaStatus: 'unknown',
  loading: false,
  error: null,

  pushActivity: (message: string): void => {
    set((state) => ({
      activityEvents: [
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          timestamp: new Date().toISOString(),
          message
        },
        ...state.activityEvents
      ].slice(0, 20)
    }))
  },

  fetchModels: async (): Promise<void> => {
    set({ loading: true, error: null })
    try {
      const models = await window.quickl.models.list()
      set({ models, loading: false })
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load local models'
      })
    }
  },

  pullModel: async (name: string): Promise<void> => {
    set((state) => ({
      pullProgress: {
        ...state.pullProgress,
        [name]: {
          name,
          status: 'starting',
          progress: 0,
          completed: null,
          total: null
        }
      }
    }))

    get().updateModelStatus(name, 'downloading')
    await window.quickl.models.pull(name)
  },

  deleteModel: async (runtime: string, name: string): Promise<void> => {
    try {
      await window.quickl.models.remove(runtime, name)
      set((state) => ({
        models: state.models.filter((model) => !(model.runtime === runtime && model.name === name))
      }))
      get().pushActivity(`Model ${name} deleted`)
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to delete model' })
      throw error
    }
  },

  loadModel: async (name: string): Promise<void> => {
    try {
      await window.quickl.models.load(name)
      get().updateModelStatus(name, 'loaded')
      get().pushActivity(`Model ${name} loaded`)
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load model' })
      throw error
    }
  },

  unloadModel: async (name: string): Promise<void> => {
    try {
      await window.quickl.models.unload(name)
      get().updateModelStatus(name, 'available')
      get().pushActivity(`Model ${name} unloaded`)
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to unload model' })
      throw error
    }
  },

  updateResourceStats: (stats: ResourceStats): void => {
    set({ resourceStats: stats })
  },

  updatePullProgress: (progress: ModelPullProgress): void => {
    const previous = get().pullProgress[progress.name]
    set((state) => ({
      pullProgress: {
        ...state.pullProgress,
        [progress.name]: progress
      },
      models: state.models.map((model) => {
        if (model.name !== progress.name) {
          return model
        }

        const isComplete = progress.status === 'success' || progress.progress >= 100
        return {
          ...model,
          status: isComplete ? 'available' : 'downloading',
          downloadProgress: progress.progress
        }
      })
    }))

    if ((progress.status === 'success' || progress.progress >= 100) && previous?.progress !== 100) {
      get().pushActivity(`Model ${progress.name} downloaded`)
    }
  },

  updateModelStatus: (name, status): void => {
    set((state) => ({
      models: state.models.map((model) =>
        model.name === name
          ? {
              ...model,
              status,
              downloadProgress: status === 'downloading' ? model.downloadProgress : null
            }
          : model
      )
    }))
  },

  checkOllamaStatus: async (): Promise<void> => {
    try {
      const status = await window.quickl.daemon.getOllamaStatus()
      set({ ollamaStatus: status })
    } catch {
      set({ ollamaStatus: 'unknown' })
    }
  },

  startOllama: async (): Promise<void> => {
    try {
      await window.quickl.daemon.startOllama()
      await get().checkOllamaStatus()
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to start Ollama' })
      throw error
    }
  },

  startResourceMonitor: async (): Promise<void> => {
    await window.quickl.models.startResourceMonitor()
  },

  stopResourceMonitor: async (): Promise<void> => {
    await window.quickl.models.stopResourceMonitor()
  },

  addTag: async (modelId: string, tag: string): Promise<void> => {
    const tags = await window.quickl.models.addTag(modelId, tag)
    set((state) => ({
      models: state.models.map((model) =>
        model.id === modelId
          ? {
              ...model,
              tags
            }
          : model
      )
    }))
  },

  removeTag: async (modelId: string, tag: string): Promise<void> => {
    const tags = await window.quickl.models.removeTag(modelId, tag)
    set((state) => ({
      models: state.models.map((model) =>
        model.id === modelId
          ? {
              ...model,
              tags
            }
          : model
      )
    }))
  }
}))
