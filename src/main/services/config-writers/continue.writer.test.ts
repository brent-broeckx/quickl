import { describe, expect, it } from 'vitest'
import { ContinueConfigWriter } from '@main/services/config-writers/continue.writer'

const PROXY_CONFIG = {
  providerProxyUrl: 'http://127.0.0.1:3820/v1',
  mcpHttpUrl: 'http://127.0.0.1:3821/mcp',
  mcpSseUrl: 'http://127.0.0.1:3821/sse',
  transport: 'http' as const,
  providerName: 'openai'
}

describe('ContinueConfigWriter', () => {
  it('adds managed model and mcp endpoint', () => {
    const writer = new ContinueConfigWriter()
    const patch = writer.generatePatch(
      {
        models: [{ title: 'Existing', provider: 'openai', model: 'gpt-4o' }]
      },
      PROXY_CONFIG,
      {
        ideType: 'vscode',
        ideName: 'VS Code'
      }
    )

    const after = JSON.parse(patch.after) as {
      models: Array<{ title: string; apiBase?: string }>
      mcpServers: { quickl?: { url?: string } }
    }

    const managed = after.models.find((entry) => entry.title === 'Quickl Active Provider')
    expect(managed?.apiBase).toBe('http://127.0.0.1:3820/v1')
    expect(after.mcpServers.quickl?.url).toBe('http://127.0.0.1:3821/mcp')
  })
})
