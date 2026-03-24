import { BaseJsonConfigWriter } from '@main/services/config-writers/json-writer.base'
import type { ConfigPatch, ProxyConfig, WriterContext } from '@main/services/config-writers/types'

export class SettingsConfigWriter extends BaseJsonConfigWriter {
  public generatePatch(current: unknown, proxyConfig: ProxyConfig, context: WriterContext): ConfigPatch {
    const beforeObject = this.toObject(current)
    const before = this.stringify(beforeObject)

    const next: Record<string, unknown> = {
      ...beforeObject,
      'quickl.providerProxyUrl': proxyConfig.providerProxyUrl,
      'quickl.mcpUrl': proxyConfig.transport === 'http' ? proxyConfig.mcpHttpUrl : proxyConfig.mcpSseUrl,
      'quickl.mcpTransport': proxyConfig.transport
    }

    if (context.ideType === 'vscode') {
      next['cline.apiProvider'] = 'openai'
      next['cline.openAiBaseUrl'] = proxyConfig.providerProxyUrl
      next['cline.openAiApiKey'] = 'quickl-managed'
    }

    if (context.ideType === 'cursor' || context.ideType === 'windsurf') {
      next['ai.provider'] = 'openai'
      next['ai.openai.base_url'] = proxyConfig.providerProxyUrl
      next['ai.openai.api_key'] = 'quickl-managed'
      next['ai.mcp.url'] = proxyConfig.transport === 'http' ? proxyConfig.mcpHttpUrl : proxyConfig.mcpSseUrl
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
