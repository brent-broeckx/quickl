import type { IDEType } from '@shared/types'
import type { IDETransport } from '@main/services/transport-selector'

export interface ProxyConfig {
  providerProxyUrl: string
  mcpHttpUrl: string
  mcpSseUrl: string
  transport: IDETransport
  providerName: string
}

export interface WriterContext {
  ideType: IDEType
  ideName: string
}

export interface ConfigPatch {
  before: string
  after: string
  filePath: string
}

export interface ConfigWriter {
  read(filePath: string): Promise<unknown>
  generatePatch(current: unknown, proxyConfig: ProxyConfig, context: WriterContext): ConfigPatch
  apply(filePath: string, patch: ConfigPatch): Promise<void>
  backup(filePath: string): Promise<string>
  restore(filePath: string, backupPath: string): Promise<void>
}
