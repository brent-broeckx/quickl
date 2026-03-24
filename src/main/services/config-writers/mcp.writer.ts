import { BaseJsonConfigWriter } from '@main/services/config-writers/json-writer.base'
import type { ConfigPatch, ProxyConfig, WriterContext } from '@main/services/config-writers/types'

export class MCPConfigWriter extends BaseJsonConfigWriter {
  public generatePatch(current: unknown, proxyConfig: ProxyConfig, _context: WriterContext): ConfigPatch {
    const beforeObject = this.toObject(current)
    const before = this.stringify(beforeObject)

    const mcpServers =
      beforeObject.mcpServers &&
      typeof beforeObject.mcpServers === 'object' &&
      !Array.isArray(beforeObject.mcpServers)
        ? { ...(beforeObject.mcpServers as Record<string, unknown>) }
        : {}

    mcpServers.quickl = {
      transport: proxyConfig.transport === 'http' ? 'streamable-http' : 'sse',
      url: proxyConfig.transport === 'http' ? proxyConfig.mcpHttpUrl : proxyConfig.mcpSseUrl
    }

    const next = {
      ...beforeObject,
      mcpServers
    }

    return {
      before,
      after: this.stringify(next),
      filePath: ''
    }
  }

  private toObject(current: unknown): Record<string, unknown> {
    if (current && typeof current === 'object' && !Array.isArray(current)) {
      return { ...(current as Record<string, unknown>) }
    }
    return {}
  }
}
