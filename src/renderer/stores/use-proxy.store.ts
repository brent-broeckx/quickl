import { create } from 'zustand'
import type { ProxyStatus } from '@shared/types'

type ProxyConflict = {
  port: number
  service: 'provider' | 'mcp'
  message: string
}

interface ProxyState {
  status: ProxyStatus | null
  ports: { providerPort: number; mcpPort: number }
  loading: boolean
  error: string | null
  conflict: ProxyConflict | null
  saveMessage: string | null
  fetchStatus: () => Promise<void>
  fetchPorts: () => Promise<void>
  setPorts: (ports: { providerPort: number; mcpPort: number }) => Promise<void>
  restart: () => Promise<void>
  startPolling: () => () => void
  dismissConflict: () => void
  clearSaveMessage: () => void
}

let pollingTimer: NodeJS.Timeout | null = null

function buildConflictMessage(payload: { port: number; service: 'provider' | 'mcp' }): string {
  const serviceLabel = payload.service === 'provider' ? 'provider proxy' : 'MCP aggregator'
  return `Port ${payload.port} is already in use. Quickl ${serviceLabel} could not start. Change the port in Settings > Proxy.`
}

export const useProxyStore = create<ProxyState>((set, get) => ({
  status: null,
  ports: {
    providerPort: 3820,
    mcpPort: 3821
  },
  loading: false,
  error: null,
  conflict: null,
  saveMessage: null,

  fetchStatus: async (): Promise<void> => {
    try {
      const status = await window.quickl.proxy.getStatus()
      set({ status, error: null })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch proxy status'
      })
    }
  },

  fetchPorts: async (): Promise<void> => {
    try {
      const ports = await window.quickl.proxy.getPorts()
      set({ ports, error: null })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch proxy ports'
      })
    }
  },

  setPorts: async (ports): Promise<void> => {
    set({ loading: true, error: null, saveMessage: null })
    try {
      await window.quickl.proxy.setPorts(ports)
      set({
        ports,
        loading: false,
        saveMessage: 'Ports updated. Restart the proxy to apply changes.'
      })
      await get().fetchStatus()
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to save proxy ports'
      })
    }
  },

  restart: async (): Promise<void> => {
    set({ loading: true, error: null })
    try {
      await window.quickl.proxy.restart()
      await get().fetchStatus()
      set({ loading: false })
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to restart proxy'
      })
    }
  },

  startPolling: (): (() => void) => {
    if (pollingTimer) {
      clearInterval(pollingTimer)
      pollingTimer = null
    }

    void get().fetchPorts()
    void get().fetchStatus()

    pollingTimer = setInterval(() => {
      void get().fetchStatus()
    }, 10_000)

    const offConflict = window.quickl.proxy.onPortConflict((payload) => {
      set({
        conflict: {
          ...payload,
          message: buildConflictMessage(payload)
        }
      })
      void get().fetchStatus()
    })

    const offMcpClient = window.quickl.proxy.onMcpClientConnected(() => {
      void get().fetchStatus()
    })

    const offRequest = window.quickl.proxy.onRequest(() => {
      void get().fetchStatus()
    })

    return (): void => {
      if (pollingTimer) {
        clearInterval(pollingTimer)
        pollingTimer = null
      }

      offConflict()
      offMcpClient()
      offRequest()
    }
  },

  dismissConflict: (): void => {
    set({ conflict: null })
  },

  clearSaveMessage: (): void => {
    set({ saveMessage: null })
  }
}))
