/**
 * Shared type definitions used across main, renderer, and preload processes.
 * All IPC communication uses these types.
 */

// ============================================================================
// PROVIDERS
// ============================================================================

export interface Provider {
  id: string
  name: string
  type: 'cloud' | 'local'
  baseUrl: string
  authType: 'api-key' | 'none' | 'bearer'
  keychainKey: string | null
  enabled: boolean
  defaultModel: string | null
  status: 'online' | 'degraded' | 'offline' | 'unknown'
  lastLatencyMs: number | null
  lastChecked: string | null
  createdAt: string
}

export type AddProviderInput = Partial<Provider>

// ============================================================================
// MODELS
// ============================================================================

export interface LocalModel {
  id: string
  name: string
  family: string
  parameterSize: string
  quantization: string
  sizeMb: number
  runtime: 'ollama' | 'lmstudio' | 'vllm' | 'jan'
  status: 'loaded' | 'available' | 'downloading'
  downloadProgress: number | null
  vramUsageMb: number | null
  tags: string[]
}

export interface OllamaRegistryModel {
  name: string
  description: string
  pulls: number
  tags: string[]
  sizes: string[]
}

export interface ModelPullProgress {
  name: string
  status: string
  progress: number
  completed: number | null
  total: number | null
}

// ============================================================================
// IDEs
// ============================================================================

export interface IDE {
  id: string
  type: IDEType
  name: string
  installPath: string
  version: string | null
  detectedExtensions: string[]
  configuredByQuickl: boolean
  configFilePath: string
  currentProviderId: string | null
  supportStatus: 'supported' | 'detected-only'
  supportMessage: string | null
}

export interface ConfigDiff {
  ideId: string
  providerId: string
  before: string
  after: string
  filePath: string
  backupPath: string | null
  generatedAt: string
}

export type IDEType =
  | 'vscode'
  | 'cursor'
  | 'windsurf'
  | 'zed'
  | 'jetbrains'
  | 'neovim'
  | 'unknown'

export interface IDEBackup {
  ideId: string
  backupPath: string
  filePath: string
  createdAt: string
}

// ============================================================================
// MCP SERVERS
// ============================================================================

export interface MCPServer {
  id: string
  name: string
  transport: 'stdio' | 'http' | 'sse'
  command: string
  args: string[]
  status: 'running' | 'stopped' | 'error'
  pid: number | null
  exposedTools: MCPTool[]
  autoStart: boolean
}

export interface MCPTool {
  name: string
  description: string
  inputSchema: unknown
}

export type MCPCatalogEntry = {
  id: string
  name: string
  description: string
  npmPackage: string
}

export type AddMCPInput = Partial<MCPServer>

// ============================================================================
// GUARDRAILS
// ============================================================================

export type GuardrailRuleType =
  | 'allowed_tools'
  | 'blocked_tools'
  | 'allowed_paths'
  | 'write_allowed'
  | 'delete_allowed'
  | 'shell_execution'
  | 'network_allowed'
  | 'max_files_per_call'

export interface GuardrailRule {
  type: GuardrailRuleType
  value: unknown
  description: string
}

export interface GuardrailSet {
  id: string
  enabled: boolean
  rules: GuardrailRule[]
  agentExceptions: string[]
  explanationMode: 'custom' | 'auto-generate'
  customMessage: string | null
  autoGenerateModelId: string | null
}

export type GuardrailLogFilter = {
  agentId?: string
  strike?: 1 | 2
  from?: string
  to?: string
}

export interface GuardrailLogEntry {
  id: string
  timestamp: string
  agentId: string
  agentVersion: string
  profileId: string
  profileName: string
  toolCallAttempted: { name: string; arguments: unknown }
  ruleViolated: string
  ruleDetail: string
  strike: 1 | 2
  explanationSent: string | null
  resolution: 'blocked' | 'manual-override' | 'agent-self-corrected'
  overrideConfirmedBy: 'user' | null
  notes: string | null
}

// ============================================================================
// PROFILES
// ============================================================================

export type ProfileConfig = Partial<Profile>

export interface Profile {
  id: string
  name: string
  defaultProviderId: string
  ideConfigs: Record<string, string>
  mcpAutoStart: string[]
  guardrailSet: GuardrailSet
  isActive: boolean
  createdAt: string
}

// ============================================================================
// LOGS
// ============================================================================

export type LogCategory =
  | 'provider'
  | 'model'
  | 'ide'
  | 'mcp'
  | 'guardrail'
  | 'proxy'
  | 'system'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogEntry {
  id: string
  timestamp: string
  level: LogLevel
  category: LogCategory
  message: string
  payload: Record<string, unknown> | null
}

export type LogFilter = {
  level?: string
  category?: string
  from?: string
  to?: string
}

// ============================================================================
// SYSTEM / STATUS
// ============================================================================

export interface ResourceStats {
  ramTotalMb: number
  ramUsedMb: number
  vramTotalMb: number | null
  vramUsedMb: number | null
  cpuPercent: number
}

export interface ProxyStatus {
  providerProxy: {
    port: number
    running: boolean
    requestCount: number
  }
  mcpAggregator: {
    port: number
    running: boolean
    connectedClients: number
  }
}

export interface TranslatedRequest {
  url: string
  method: string
  headers: Record<string, string>
  body: string
}

export interface TranslatedResponse {
  status: number
  headers: Record<string, string>
  body: string | NodeJS.ReadableStream
}

export interface ConnectedMCPClient {
  id: string
  name: string
  version: string
  transport: 'http' | 'sse'
  connectedAt: string
}

export type DiagnosticsReport = Record<string, unknown>

export type UpdateCheckResult = {
  available: boolean
  version?: string
}

// ============================================================================
// BRIDGE CONTRACT
// ============================================================================

export interface QuicklBridge {
  providers: {
    list(): Promise<Provider[]>
    add(config: AddProviderInput): Promise<Provider>
    update(id: string, config: Partial<Provider>): Promise<Provider>
    remove(id: string): Promise<void>
    testConnection(id: string): Promise<{ ok: boolean; latencyMs: number; error?: string }>
    listModels(id: string): Promise<string[]>
    setApiKey(id: string, key: string): Promise<void>
    getApiKeyHint(id: string): Promise<string>
    onStatusChanged(
      callback: (payload: { id: string; status: Provider['status']; latencyMs: number | null }) => void
    ): () => void
  }
  models: {
    list(): Promise<LocalModel[]>
    pull(name: string): Promise<void>
    remove(runtime: string, name: string): Promise<void>
    load(name: string): Promise<void>
    unload(name: string): Promise<void>
    getStats(): Promise<ResourceStats>
    search(query: string): Promise<OllamaRegistryModel[]>
    getTags(modelId: string): Promise<string[]>
    addTag(modelId: string, tag: string): Promise<string[]>
    removeTag(modelId: string, tag: string): Promise<string[]>
    startResourceMonitor(): Promise<void>
    stopResourceMonitor(): Promise<void>
    onPullProgress(callback: (progress: ModelPullProgress) => void): () => void
    onResourceStats(callback: (stats: ResourceStats) => void): () => void
  }
  daemon: {
    getOllamaStatus(): Promise<'running' | 'stopped' | 'not-installed'>
    startOllama(): Promise<void>
  }
  ides: {
    list(): Promise<IDE[]>
    scan(): Promise<IDE[]>
    configure(ideId: string, providerId: string): Promise<ConfigDiff>
    applyConfig(ideId: string, diff: ConfigDiff): Promise<void>
    resetConfig(ideId: string): Promise<void>
    listBackups(ideId: string): Promise<IDEBackup[]>
    restoreBackup(ideId: string, backupPath: string): Promise<void>
  }
  mcp: {
    list(): Promise<MCPServer[]>
    catalog(): Promise<MCPCatalogEntry[]>
    add(config: AddMCPInput): Promise<MCPServer>
    remove(id: string): Promise<void>
    start(id: string): Promise<void>
    stop(id: string): Promise<void>
    listTools(id: string): Promise<MCPTool[]>
  }
  guardrails: {
    getSet(profileId: string): Promise<GuardrailSet>
    updateSet(profileId: string, set: Partial<GuardrailSet>): Promise<GuardrailSet>
    addAgentException(profileId: string, agentId: string): Promise<void>
    removeAgentException(profileId: string, agentId: string): Promise<void>
    getLogs(filter?: GuardrailLogFilter): Promise<GuardrailLogEntry[]>
    resolveViolation(logId: string, action: 'dismiss' | 'allow-once'): Promise<void>
  }
  profiles: {
    list(): Promise<Profile[]>
    create(name: string, config: ProfileConfig): Promise<Profile>
    activate(id: string): Promise<void>
    remove(id: string): Promise<void>
    export(id: string): Promise<string>
    import(json: string): Promise<Profile>
  }
  logs: {
    list(filter?: LogFilter): Promise<LogEntry[]>
    export(filter?: LogFilter): Promise<string>
    clear(): Promise<void>
    onNewEntry(callback: (entry: LogEntry) => void): () => void
  }
  proxy: {
    getStatus(): Promise<ProxyStatus>
    restart(): Promise<void>
    getPorts(): Promise<{ providerPort: number; mcpPort: number }>
    setPorts(ports: { providerPort: number; mcpPort: number }): Promise<void>
    onPortConflict(
      callback: (payload: { port: number; service: 'provider' | 'mcp' }) => void
    ): () => void
    onMcpClientConnected(callback: (client: ConnectedMCPClient) => void): () => void
    onRequest(
      callback: (payload: { method: string; path: string; status: number; latencyMs: number }) => void
    ): () => void
  }
  system: {
    getDiagnostics(): Promise<DiagnosticsReport>
    openDataDirectory(): Promise<void>
    openExternal(url: string): Promise<void>
    checkForUpdates(): Promise<UpdateCheckResult>
    getVersion(): Promise<string>
  }
}
