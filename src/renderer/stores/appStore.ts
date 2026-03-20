import { create } from 'zustand'
import type {
  Provider,
  LocalModel,
  IDE,
  MCPServer,
  Profile,
  LogEntry
} from '@shared/types'

interface AppState {
  // Data
  providers: Provider[]
  models: LocalModel[]
  ides: IDE[]
  mcpServers: MCPServer[]
  profiles: Profile[]
  logs: LogEntry[]

  // UI state
  isLoading: boolean
  selectedProviderId: string | null

  // Actions
  setProviders: (providers: Provider[]) => void
  setModels: (models: LocalModel[]) => void
  setIDEs: (ides: IDE[]) => void
  setMCPServers: (servers: MCPServer[]) => void
  setProfiles: (profiles: Profile[]) => void
  addLog: (entry: LogEntry) => void
  setLoading: (loading: boolean) => void
}

/**
 * Global app state store using Zustand
 * Persists to electron-store via IPC
 */
export const useAppStore = create<AppState>((set) => ({
  providers: [],
  models: [],
  ides: [],
  mcpServers: [],
  profiles: [],
  logs: [],
  isLoading: false,
  selectedProviderId: null,

  setProviders: (providers): void => set({ providers }),
  setModels: (models): void => set({ models }),
  setIDEs: (ides): void => set({ ides }),
  setMCPServers: (servers): void => set({ mcpServers: servers }),
  setProfiles: (profiles): void => set({ profiles }),
  addLog: (entry): void => set((state) => ({ logs: [...state.logs, entry] })),
  setLoading: (loading): void => set({ isLoading: loading })
}))
