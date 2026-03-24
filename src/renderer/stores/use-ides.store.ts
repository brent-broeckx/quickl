import { create } from 'zustand'
import type { ConfigDiff, IDE, IDEBackup } from '@shared/types'

interface IDEsState {
  ides: IDE[]
  pendingDiff: ConfigDiff | null
  backupsByIde: Record<string, IDEBackup[]>
  loading: boolean
  scanning: boolean
  error: string | null
  fetchIDEs: () => Promise<void>
  scanIDEs: () => Promise<void>
  previewConfig: (ideId: string, providerId: string) => Promise<ConfigDiff>
  applyConfig: (ideId: string) => Promise<void>
  resetConfig: (ideId: string) => Promise<void>
  fetchBackups: (ideId: string) => Promise<void>
  restoreBackup: (ideId: string, backupPath: string) => Promise<void>
  clearPendingDiff: () => void
}

export const useIDEsStore = create<IDEsState>((set, get) => ({
  ides: [],
  pendingDiff: null,
  backupsByIde: {},
  loading: false,
  scanning: false,
  error: null,

  fetchIDEs: async (): Promise<void> => {
    set({ loading: true, error: null })
    try {
      const ides = await window.quickl.ides.list()
      set({ ides, loading: false })
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load IDEs'
      })
    }
  },

  scanIDEs: async (): Promise<void> => {
    set({ scanning: true, error: null })
    try {
      const ides = await window.quickl.ides.scan()
      set({ ides, scanning: false })
    } catch (error) {
      set({
        scanning: false,
        error: error instanceof Error ? error.message : 'Failed to scan IDEs'
      })
    }
  },

  previewConfig: async (ideId: string, providerId: string): Promise<ConfigDiff> => {
    set({ loading: true, error: null })
    try {
      const diff = await window.quickl.ides.configure(ideId, providerId)
      set({ pendingDiff: diff, loading: false })
      return diff
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate config diff'
      set({ loading: false, error: message })
      throw error
    }
  },

  applyConfig: async (ideId: string): Promise<void> => {
    const pendingDiff = get().pendingDiff
    if (!pendingDiff || pendingDiff.ideId !== ideId) {
      throw new Error('No pending diff available for this IDE')
    }

    set({ loading: true, error: null })
    try {
      await window.quickl.ides.applyConfig(ideId, pendingDiff)
      const [ides, backups] = await Promise.all([
        window.quickl.ides.list(),
        window.quickl.ides.listBackups(ideId)
      ])
      set((state) => ({
        ides,
        pendingDiff: null,
        loading: false,
        backupsByIde: {
          ...state.backupsByIde,
          [ideId]: backups
        }
      }))
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to apply config'
      })
      throw error
    }
  },

  resetConfig: async (ideId: string): Promise<void> => {
    set({ loading: true, error: null })
    try {
      await window.quickl.ides.resetConfig(ideId)
      const [ides, backups] = await Promise.all([
        window.quickl.ides.list(),
        window.quickl.ides.listBackups(ideId)
      ])
      set((state) => ({
        ides,
        loading: false,
        pendingDiff: null,
        backupsByIde: {
          ...state.backupsByIde,
          [ideId]: backups
        }
      }))
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to reset IDE config'
      })
      throw error
    }
  },

  fetchBackups: async (ideId: string): Promise<void> => {
    try {
      const backups = await window.quickl.ides.listBackups(ideId)
      set((state) => ({
        backupsByIde: {
          ...state.backupsByIde,
          [ideId]: backups
        }
      }))
    } catch {
      // Ignore backup list failures in the background.
    }
  },

  restoreBackup: async (ideId: string, backupPath: string): Promise<void> => {
    set({ loading: true, error: null })
    try {
      await window.quickl.ides.restoreBackup(ideId, backupPath)
      const [ides, backups] = await Promise.all([
        window.quickl.ides.list(),
        window.quickl.ides.listBackups(ideId)
      ])
      set((state) => ({
        ides,
        loading: false,
        pendingDiff: null,
        backupsByIde: {
          ...state.backupsByIde,
          [ideId]: backups
        }
      }))
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to restore backup'
      })
      throw error
    }
  },

  clearPendingDiff: (): void => set({ pendingDiff: null })
}))
