import { create } from 'zustand'
import type { AddProviderInput, Provider } from '@shared/types'

type TestConnectionResult = { ok: boolean; latencyMs: number; error?: string }

interface ProvidersState {
  providers: Provider[]
  loading: boolean
  error: string | null
  fetchProviders: () => Promise<void>
  addProvider: (config: AddProviderInput, key?: string) => Promise<void>
  updateProvider: (id: string, config: Partial<Provider>) => Promise<void>
  removeProvider: (id: string) => Promise<void>
  testConnection: (id: string) => Promise<TestConnectionResult>
  updateProviderStatus: (
    id: string,
    status: Provider['status'],
    latencyMs: number | null
  ) => void
}

export const useProvidersStore = create<ProvidersState>((set, get) => ({
  providers: [],
  loading: false,
  error: null,

  fetchProviders: async (): Promise<void> => {
    set({ loading: true, error: null })
    try {
      const providers = await window.quickl.providers.list()
      set({ providers, loading: false })
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load providers'
      })
    }
  },

  addProvider: async (config: AddProviderInput, key?: string): Promise<void> => {
    set({ loading: true, error: null })
    try {
      const provider = await window.quickl.providers.add(config)
      if (key?.trim()) {
        await window.quickl.providers.setApiKey(provider.id, key)
      }

      const nextProviders = [...get().providers, provider]
      set({ providers: nextProviders, loading: false })
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to add provider'
      })
      throw error
    }
  },

  updateProvider: async (id: string, config: Partial<Provider>): Promise<void> => {
    set({ loading: true, error: null })
    try {
      const updatedProvider = await window.quickl.providers.update(id, config)
      set((state) => ({
        providers: state.providers.map((provider) =>
          provider.id === id ? updatedProvider : provider
        ),
        loading: false
      }))
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to update provider'
      })
      throw error
    }
  },

  removeProvider: async (id: string): Promise<void> => {
    set({ loading: true, error: null })
    try {
      await window.quickl.providers.remove(id)
      set((state) => ({
        providers: state.providers.filter((provider) => provider.id !== id),
        loading: false
      }))
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to remove provider'
      })
      throw error
    }
  },

  testConnection: async (id: string): Promise<TestConnectionResult> => {
    try {
      const result = await window.quickl.providers.testConnection(id)
      let status: Provider['status'] = 'offline'
      if (result.ok) {
        status = 'online'
      } else if (result.error === 'Invalid API key') {
        status = 'degraded'
      }

      set((state) => ({
        providers: state.providers.map((provider) =>
          provider.id === id
            ? {
                ...provider,
                status,
                lastLatencyMs: result.latencyMs,
                lastChecked: new Date().toISOString()
              }
            : provider
        )
      }))
      return result
    } catch (error) {
      return {
        ok: false,
        latencyMs: 0,
        error: error instanceof Error ? error.message : 'Could not test provider'
      }
    }
  },

  updateProviderStatus: (id, status, latencyMs): void => {
    set((state) => ({
      providers: state.providers.map((provider) =>
        provider.id === id
          ? {
              ...provider,
              status,
              lastLatencyMs: latencyMs,
              lastChecked: new Date().toISOString()
            }
          : provider
      )
    }))
  }
}))

void useProvidersStore.getState().fetchProviders()
