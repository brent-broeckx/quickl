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
  ModelPullProgress,
  ProxyStatus,
  ConfigDiff,
  IDEBackup,
  AddProviderInput,
  OllamaRegistryModel,
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
    pull: (name: string) => Promise<void>
    remove: (runtime: string, name: string) => Promise<void>
    load: (name: string) => Promise<void>
    unload: (name: string) => Promise<void>
    getStats: () => Promise<ResourceStats>
    search: (query: string) => Promise<OllamaRegistryModel[]>
    getTags: (modelId: string) => Promise<string[]>
    addTag: (modelId: string, tag: string) => Promise<string[]>
    removeTag: (modelId: string, tag: string) => Promise<string[]>
    startResourceMonitor: () => Promise<void>
    stopResourceMonitor: () => Promise<void>
    onPullProgress: (callback: (progress: ModelPullProgress) => void) => () => void
    onResourceStats: (callback: (stats: ResourceStats) => void) => () => void
  }
  daemon: {
    getOllamaStatus: () => Promise<'running' | 'stopped' | 'not-installed'>
    startOllama: () => Promise<void>
  }
  ides: {
    list: () => Promise<IDE[]>
    scan: () => Promise<IDE[]>
    configure: (ideId: string, providerId: string) => Promise<ConfigDiff>
    applyConfig: (ideId: string, diff: ConfigDiff) => Promise<void>
    resetConfig: (ideId: string) => Promise<void>
    listBackups: (ideId: string) => Promise<IDEBackup[]>
    restoreBackup: (ideId: string, backupPath: string) => Promise<void>
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
    getPorts: () => Promise<{ providerPort: number; mcpPort: number }>
    setPorts: (ports: { providerPort: number; mcpPort: number }) => Promise<void>
    onPortConflict: (
      callback: (payload: { port: number; service: 'provider' | 'mcp' }) => void
    ) => () => void
    onMcpClientConnected: (
      callback: (client: { id: string; name: string; version: string; transport: 'http' | 'sse'; connectedAt: string }) => void
    ) => () => void
    onRequest: (
      callback: (payload: { method: string; path: string; status: number; latencyMs: number }) => void
    ) => () => void
  }
  system: {
    getDiagnostics: () => Promise<DiagnosticsReport>
    openDataDirectory: () => Promise<void>
    openExternal: (url: string) => Promise<void>
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
    pull: (name) => ipcRenderer.invoke('models:pull', name),
    remove: (runtime, name) => ipcRenderer.invoke('models:remove', runtime, name),
    load: (name) => ipcRenderer.invoke('models:load', name),
    unload: (name) => ipcRenderer.invoke('models:unload', name),
    getStats: () => ipcRenderer.invoke('models:getStats'),
    search: (query) => ipcRenderer.invoke('models:search', query),
    getTags: (modelId) => ipcRenderer.invoke('models:getTags', modelId),
    addTag: (modelId, tag) => ipcRenderer.invoke('models:addTag', modelId, tag),
    removeTag: (modelId, tag) => ipcRenderer.invoke('models:removeTag', modelId, tag),
    startResourceMonitor: () => ipcRenderer.invoke('resource-monitor:start'),
    stopResourceMonitor: () => ipcRenderer.invoke('resource-monitor:stop'),
    onPullProgress: (callback): (() => void) => {
      const listener = (_event: unknown, progress: ModelPullProgress): void => callback(progress)
      ipcRenderer.on('quickl:model-pull-progress', listener)
      return () => ipcRenderer.off('quickl:model-pull-progress', listener)
    },
    onResourceStats: (callback): (() => void) => {
      const listener = (_event: unknown, stats: ResourceStats): void => callback(stats)
      ipcRenderer.on('quickl:resource-stats', listener)
      return () => ipcRenderer.off('quickl:resource-stats', listener)
    }
  },

  daemon: {
    getOllamaStatus: () => ipcRenderer.invoke('daemon:ollamaStatus'),
    startOllama: () => ipcRenderer.invoke('daemon:startOllama')
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
    resetConfig: (ideId) => ipcRenderer.invoke('ides:reset-config', ideId),
    listBackups: (ideId) => ipcRenderer.invoke('ides:list-backups', ideId),
    restoreBackup: (ideId, backupPath) => ipcRenderer.invoke('ides:restore-backup', ideId, backupPath)
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
    restart: () => ipcRenderer.invoke('proxy:restart'),
    getPorts: () => ipcRenderer.invoke('proxy:get-ports'),
    setPorts: (ports) => ipcRenderer.invoke('proxy:set-ports', ports),
    onPortConflict: (callback): (() => void) => {
      const listener = (
        _event: unknown,
        payload: { port: number; service: 'provider' | 'mcp' }
      ): void => callback(payload)
      ipcRenderer.on('quickl:proxy-port-conflict', listener)
      return () => ipcRenderer.off('quickl:proxy-port-conflict', listener)
    },
    onMcpClientConnected: (callback): (() => void) => {
      const listener = (
        _event: unknown,
        client: { id: string; name: string; version: string; transport: 'http' | 'sse'; connectedAt: string }
      ): void => callback(client)
      ipcRenderer.on('quickl:mcp-client-connected', listener)
      return () => ipcRenderer.off('quickl:mcp-client-connected', listener)
    },
    onRequest: (callback): (() => void) => {
      const listener = (
        _event: unknown,
        payload: { method: string; path: string; status: number; latencyMs: number }
      ): void => callback(payload)
      ipcRenderer.on('quickl:proxy-request', listener)
      return () => ipcRenderer.off('quickl:proxy-request', listener)
    }
  },

  // =========================================================================
  // SYSTEM
  // =========================================================================
  system: {
    getDiagnostics: () => ipcRenderer.invoke('system:get-diagnostics'),
    openDataDirectory: () => ipcRenderer.invoke('system:open-data-directory'),
    openExternal: (url) => ipcRenderer.invoke('system:open-external', url),
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
