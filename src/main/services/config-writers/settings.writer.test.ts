import { describe, expect, it } from 'vitest'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { SettingsConfigWriter } from '@main/services/config-writers/settings.writer'

const PROXY_CONFIG = {
  providerProxyUrl: 'http://127.0.0.1:3820/v1',
  mcpHttpUrl: 'http://127.0.0.1:3821/mcp',
  mcpSseUrl: 'http://127.0.0.1:3821/sse',
  transport: 'http' as const,
  providerName: 'openai'
}

describe('SettingsConfigWriter', () => {
  it('adds proxy settings for VS Code while preserving existing keys', () => {
    const writer = new SettingsConfigWriter()
    const patch = writer.generatePatch(
      {
        'editor.fontSize': 14
      },
      PROXY_CONFIG,
      {
        ideType: 'vscode',
        ideName: 'VS Code'
      }
    )

    const after = JSON.parse(patch.after) as Record<string, string | number>
    expect(after['editor.fontSize']).toBe(14)
    expect(after['quickl.providerProxyUrl']).toBe('http://127.0.0.1:3820/v1')
    expect(after['quickl.mcpUrl']).toBe('http://127.0.0.1:3821/mcp')
    expect(after['quickl.mcpTransport']).toBe('http')
    expect(after['cline.openAiBaseUrl']).toBe('http://127.0.0.1:3820/v1')
  })

  it('writes cursor-specific fields', () => {
    const writer = new SettingsConfigWriter()
    const patch = writer.generatePatch(
      {},
      PROXY_CONFIG,
      {
        ideType: 'cursor',
        ideName: 'Cursor'
      }
    )

    const after = JSON.parse(patch.after) as Record<string, string>
    expect(after['ai.provider']).toBe('openai')
    expect(after['ai.openai.base_url']).toBe('http://127.0.0.1:3820/v1')
    expect(after['ai.mcp.url']).toBe('http://127.0.0.1:3821/mcp')
  })

  it('creates a backup and can restore first-apply state for a missing file', async () => {
    const writer = new SettingsConfigWriter()
    const tempDir = await mkdtemp(join(tmpdir(), 'quickl-writer-'))
    const configPath = join(tempDir, 'settings.json')

    try {
      const patch = writer.generatePatch(
        {},
        PROXY_CONFIG,
        {
          ideType: 'vscode',
          ideName: 'VS Code'
        }
      )

      const backupPath = await writer.backup(configPath)
      await writer.apply(configPath, {
        ...patch,
        filePath: configPath
      })

      const afterApply = await readFile(configPath, 'utf-8')
      expect(afterApply).toContain('quickl.providerProxyUrl')

      await writer.restore(configPath, backupPath)

      await expect(readFile(configPath, 'utf-8')).rejects.toMatchObject({ code: 'ENOENT' })
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })
})
