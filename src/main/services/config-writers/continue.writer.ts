import { BaseJsonConfigWriter } from '@main/services/config-writers/json-writer.base'
import type { ConfigPatch, ProxyConfig, WriterContext } from '@main/services/config-writers/types'

type ContinueModel = {
  title: string
  provider: string
  model: string
  apiBase: string
  apiKey: string
}

export class ContinueConfigWriter extends BaseJsonConfigWriter {
  public generatePatch(current: unknown, proxyConfig: ProxyConfig, _context: WriterContext): ConfigPatch {
    const beforeObject = this.toObject(current)
    const before = this.stringify(beforeObject)

    const next = { ...beforeObject }
    const models = Array.isArray(next.models) ? [...next.models] : []

    const managedModel: ContinueModel = {
      title: 'Quickl Active Provider',
      provider: 'openai',
      model: 'quickl-active',
      apiBase: proxyConfig.providerProxyUrl,
      apiKey: 'quickl-managed'
    }

    const existingIndex = models.findIndex(
      (entry) =>
        typeof entry === 'object' &&
        entry !== null &&
        (entry as { title?: string }).title === managedModel.title
    )

    if (existingIndex >= 0) {
      models[existingIndex] = managedModel
    } else {
      models.push(managedModel)
    }

    next.models = models

    const mcpServers =
      next.mcpServers && typeof next.mcpServers === 'object' && !Array.isArray(next.mcpServers)
        ? { ...(next.mcpServers as Record<string, unknown>) }
        : {}

    mcpServers.quickl = {
      transport: proxyConfig.transport === 'http' ? 'streamable-http' : 'sse',
      url: proxyConfig.transport === 'http' ? proxyConfig.mcpHttpUrl : proxyConfig.mcpSseUrl
    }

    next.mcpServers = mcpServers

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
