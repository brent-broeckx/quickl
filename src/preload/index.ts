import { contextBridge, ipcRenderer } from 'electron'
import type {
  Provider,
  LocalModel,
  IDE,
  MCPServer,
  MCPTool,
  GuardrailSet,
  GuardrailLogEntry,
  GuardrailLogFilter,
  Profile,
  ProfileConfig,
  LogEntry,
  LogFilter,
  ResourceStats,
  ProxyStatus,
  ConfigDiff,
  AddProviderInput,
  MCPCatalogEntry,
  AddMCPInput,
  DiagnosticsReport,
  UpdateCheckResult
} from '@shared/types'

interface QuicklBridge {
  providers: {
    list: () => Promise<Provider[]>
    add: (config: AddProviderInput) => Promise<Provider>
    update: (id: string, config: Partial<Provider>) => Promise<Provider>
    remove: (id: string) => Promise<void>
    testConnection: (id: string) => Promise<{ ok: boolean; latencyMs: number; error?: string }>
    listModels: (id: string) => Promise<string[]>
    setApiKey: (id: string, key: string) => Promise<void>
    getApiKeyHint: (id: string) => Promise<string>
    onStatusChanged: (
      callback: (payload: { id: string; status: Provider['status']; latencyMs: number | null }) => void
    ) => () => void
  }
  models: {
    list: () => Promise<LocalModel[]>
    pull: (runtime: string, name: string) => Promise<void>
    remove: (runtime: string, name: string) => Promise<void>
    load: (runtime: string, name: string) => Promise<void>
    unload: (runtime: string, name: string) => Promise<void>
    getResourceStats: () => Promise<ResourceStats>
    search: (query: string) => Promise<unknown[]>
  }
  ides: {
    list: () => Promise<IDE[]>
    scan: () => Promise<IDE[]>
    configure: (ideId: string, providerId: string) => Promise<ConfigDiff>
    applyConfig: (ideId: string, diff: ConfigDiff) => Promise<void>
    resetConfig: (ideId: string) => Promise<void>
  }
  mcp: {
    list: () => Promise<MCPServer[]>
    catalog: () => Promise<MCPCatalogEntry[]>
    add: (config: AddMCPInput) => Promise<MCPServer>
    remove: (id: string) => Promise<void>
    start: (id: string) => Promise<void>
    stop: (id: string) => Promise<void>
    listTools: (id: string) => Promise<MCPTool[]>
  }
  guardrails: {
    getSet: (profileId: string) => Promise<GuardrailSet>
    updateSet: (profileId: string, set: Partial<GuardrailSet>) => Promise<GuardrailSet>
    addAgentException: (profileId: string, agentId: string) => Promise<void>
    removeAgentException: (profileId: string, agentId: string) => Promise<void>
    getLogs: (filter?: GuardrailLogFilter) => Promise<GuardrailLogEntry[]>
    resolveViolation: (logId: string, action: 'dismiss' | 'allow-once') => Promise<void>
  }
  profiles: {
    list: () => Promise<Profile[]>
    create: (name: string, config: ProfileConfig) => Promise<Profile>
    activate: (id: string) => Promise<void>
    remove: (id: string) => Promise<void>
    export: (id: string) => Promise<string>
    import: (json: string) => Promise<Profile>
  }
  logs: {
    list: (filter?: LogFilter) => Promise<LogEntry[]>
    export: (filter?: LogFilter) => Promise<string>
    clear: () => Promise<void>
    onNewEntry: (callback: (entry: LogEntry) => void) => () => void
  }
  proxy: {
    getStatus: () => Promise<ProxyStatus>
    restart: () => Promise<void>
  }
  system: {
    getDiagnostics: () => Promise<DiagnosticsReport>
    openDataDirectory: () => Promise<void>
    checkForUpdates: () => Promise<UpdateCheckResult>
    getVersion: () => Promise<string>
  }
}

const bridge: QuicklBridge = {
  // =========================================================================
  // PROVIDERS
  // =========================================================================
  providers: {
    list: () => ipcRenderer.invoke('providers:list'),
    add: (config) => ipcRenderer.invoke('providers:add', config),
    update: (id, config) => ipcRenderer.invoke('providers:update', id, config),
    remove: (id) => ipcRenderer.invoke('providers:remove', id),
    testConnection: (id) => ipcRenderer.invoke('providers:test-connection', id),
    listModels: (id) => ipcRenderer.invoke('providers:list-models', id),
    setApiKey: (id, key) => ipcRenderer.invoke('providers:set-api-key', id, key),
    getApiKeyHint: (id) => ipcRenderer.invoke('providers:get-api-key-hint', id),
    onStatusChanged: (callback): (() => void) => {
      const listener = (
        _event: unknown,
        payload: { id: string; status: Provider['status']; latencyMs: number | null }
      ): void => callback(payload)
      ipcRenderer.on('quickl:provider-status-changed', listener)
      return () => ipcRenderer.off('quickl:provider-status-changed', listener)
    }
  },

  // =========================================================================
  // MODELS
  // =========================================================================
  models: {
    list: () => ipcRenderer.invoke('models:list'),
    pull: (runtime, name) => ipcRenderer.invoke('models:pull', runtime, name),
    remove: (runtime, name) => ipcRenderer.invoke('models:remove', runtime, name),
    load: (runtime, name) => ipcRenderer.invoke('models:load', runtime, name),
    unload: (runtime, name) => ipcRenderer.invoke('models:unload', runtime, name),
    getResourceStats: () => ipcRenderer.invoke('models:get-resource-stats'),
    search: (query) => ipcRenderer.invoke('models:search', query)
  },

  // =========================================================================
  // IDEs
  // =========================================================================
  ides: {
    list: () => ipcRenderer.invoke('ides:list'),
    scan: () => ipcRenderer.invoke('ides:scan'),
    configure: (ideId, providerId) =>
      ipcRenderer.invoke('ides:configure', ideId, providerId),
    applyConfig: (ideId, diff) => ipcRenderer.invoke('ides:apply-config', ideId, diff),
    resetConfig: (ideId) => ipcRenderer.invoke('ides:reset-config', ideId)
  },

  // =========================================================================
  // MCP
  // =========================================================================
  mcp: {
    list: () => ipcRenderer.invoke('mcp:list'),
    catalog: () => ipcRenderer.invoke('mcp:catalog'),
    add: (config) => ipcRenderer.invoke('mcp:add', config),
    remove: (id) => ipcRenderer.invoke('mcp:remove', id),
    start: (id) => ipcRenderer.invoke('mcp:start', id),
    stop: (id) => ipcRenderer.invoke('mcp:stop', id),
    listTools: (id) => ipcRenderer.invoke('mcp:list-tools', id)
  },

  // =========================================================================
  // GUARDRAILS
  // =========================================================================
  guardrails: {
    getSet: (profileId) => ipcRenderer.invoke('guardrails:get-set', profileId),
    updateSet: (profileId, set) =>
      ipcRenderer.invoke('guardrails:update-set', profileId, set),
    addAgentException: (profileId, agentId) =>
      ipcRenderer.invoke('guardrails:add-agent-exception', profileId, agentId),
    removeAgentException: (profileId, agentId) =>
      ipcRenderer.invoke('guardrails:remove-agent-exception', profileId, agentId),
    getLogs: (filter) => ipcRenderer.invoke('guardrails:get-logs', filter),
    resolveViolation: (logId, action) =>
      ipcRenderer.invoke('guardrails:resolve-violation', logId, action)
  },

  // =========================================================================
  // PROFILES
  // =========================================================================
  profiles: {
    list: () => ipcRenderer.invoke('profiles:list'),
    create: (name, config) => ipcRenderer.invoke('profiles:create', name, config),
    activate: (id) => ipcRenderer.invoke('profiles:activate', id),
    remove: (id) => ipcRenderer.invoke('profiles:remove', id),
    export: (id) => ipcRenderer.invoke('profiles:export', id),
    import: (json) => ipcRenderer.invoke('profiles:import', json)
  },

  // =========================================================================
  // LOGS
  // =========================================================================
  logs: {
    list: (filter) => ipcRenderer.invoke('logs:list', filter),
    export: (filter) => ipcRenderer.invoke('logs:export', filter),
    clear: () => ipcRenderer.invoke('logs:clear'),
    onNewEntry: (callback): (() => void) => {
      const listener = (_: unknown, entry: LogEntry): void => callback(entry)
      ipcRenderer.on('quickl:log-entry', listener)
      return () => ipcRenderer.off('quickl:log-entry', listener)
    }
  },

  // =========================================================================
  // PROXY
  // =========================================================================
  proxy: {
    getStatus: () => ipcRenderer.invoke('proxy:get-status'),
    restart: () => ipcRenderer.invoke('proxy:restart')
  },

  // =========================================================================
  // SYSTEM
  // =========================================================================
  system: {
    getDiagnostics: () => ipcRenderer.invoke('system:get-diagnostics'),
    openDataDirectory: () => ipcRenderer.invoke('system:open-data-directory'),
    checkForUpdates: () => ipcRenderer.invoke('system:check-for-updates'),
    getVersion: () => ipcRenderer.invoke('system:get-version')
  }
}

// Expose bridge to renderer via contextBridge
contextBridge.exposeInMainWorld('quickl', bridge)

// Phase 0 theme controls backed by electron-store in main process.
contextBridge.exposeInMainWorld('quicklTheme', {
  getTheme: (): Promise<'light' | 'dark' | 'system'> => ipcRenderer.invoke('settings:get-theme'),
  setTheme: (theme: 'light' | 'dark' | 'system'): Promise<void> =>
    ipcRenderer.invoke('settings:set-theme', theme)
})

// Export type for use in renderer
export type { QuicklBridge }
