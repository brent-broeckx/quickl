import type { ConfigDiff, IDE, IDEBackup, Provider } from '@shared/types'
import { access, constants } from 'node:fs/promises'
import { store } from '@main/lib/store'
import { logger } from '@main/lib/logger'
import { ideDetector } from '@main/services/ide-detector'
import { selectIDETransport } from '@main/services/transport-selector'
import { ProviderService } from '@main/services/provider.service'
import { ContinueConfigWriter } from '@main/services/config-writers/continue.writer'
import { MCPConfigWriter } from '@main/services/config-writers/mcp.writer'
import { SettingsConfigWriter } from '@main/services/config-writers/settings.writer'
import type { ConfigWriter, ProxyConfig, WriterContext } from '@main/services/config-writers/types'

type PendingDiff = {
  ideId: string
  providerId: string
  filePath: string
  writer: ConfigWriter
  patch: {
    before: string
    after: string
    filePath: string
  }
}

const providerService = new ProviderService()

export class IDEService {
  private pendingDiffs = new Map<string, PendingDiff>()

  private async backupExists(backupPath: string): Promise<boolean> {
    try {
      await access(backupPath, constants.F_OK)
      return true
    } catch {
      return false
    }
  }

  public async list(): Promise<IDE[]> {
    return store.get('ides', [])
  }

  public async scan(): Promise<IDE[]> {
    const scanned = await ideDetector.scan()
    const existing = new Map((store.get('ides', []) as IDE[]).map((ide) => [ide.id, ide]))

    const merged = scanned.map((ide) => {
      const previous = existing.get(ide.id)
      if (!previous) {
        return ide
      }

      return {
        ...ide,
        configuredByQuickl: previous.configuredByQuickl,
        currentProviderId: previous.currentProviderId
      }
    })

    store.set('ides', merged)
    return merged
  }

  public async configure(ideId: string, providerId: string): Promise<ConfigDiff> {
    const ides = await this.list()
    const ide = ides.find((entry) => entry.id === ideId)
    if (!ide) {
      throw new Error('IDE not found. Run scan and try again.')
    }

    if (ide.supportStatus !== 'supported') {
      throw new Error(ide.supportMessage || 'This IDE is detected only in MVP.')
    }

    const provider = await this.requireProvider(providerId)
    const transport = selectIDETransport(ide.type, ide.version)

    const proxyConfig: ProxyConfig = {
      providerProxyUrl: 'http://127.0.0.1:3820/v1',
      mcpHttpUrl: 'http://127.0.0.1:3821/mcp',
      mcpSseUrl: 'http://127.0.0.1:3821/sse',
      transport,
      providerName: provider.name
    }

    const writer = this.getWriterForIDE(ide)
    const current = await writer.read(ide.configFilePath)
    const context: WriterContext = {
      ideType: ide.type,
      ideName: ide.name
    }

    const patch = writer.generatePatch(current, proxyConfig, context)
    const normalizedPatch = {
      ...patch,
      filePath: ide.configFilePath
    }

    this.pendingDiffs.set(ideId, {
      ideId,
      providerId,
      filePath: ide.configFilePath,
      writer,
      patch: normalizedPatch
    })

    return {
      ideId,
      providerId,
      before: normalizedPatch.before,
      after: normalizedPatch.after,
      filePath: ide.configFilePath,
      backupPath: null,
      generatedAt: new Date().toISOString()
    }
  }

  public async applyConfig(ideId: string, diff: ConfigDiff): Promise<void> {
    const pending = this.pendingDiffs.get(ideId)
    if (!pending) {
      throw new Error('No pending configuration found. Generate a diff first.')
    }

    if (pending.patch.after !== diff.after || pending.patch.filePath !== diff.filePath) {
      throw new Error('Config diff is stale. Generate a new preview before applying.')
    }

    const backupPath = await pending.writer.backup(pending.filePath)
    await pending.writer.apply(pending.filePath, pending.patch)

    const backups = store.get('ideBackups', []) as IDEBackup[]
    backups.unshift({
      ideId,
      backupPath,
      filePath: pending.filePath,
      createdAt: new Date().toISOString()
    })
    store.set('ideBackups', backups.slice(0, 50))

    const ides = (store.get('ides', []) as IDE[]).map((ide) =>
      ide.id === ideId
        ? {
            ...ide,
            configuredByQuickl: true,
            currentProviderId: pending.providerId
          }
        : ide
    )

    store.set('ides', ides)
    this.pendingDiffs.delete(ideId)

    logger.info('ide', 'IDE configuration applied', {
      ideId,
      providerId: pending.providerId,
      filePath: pending.filePath,
      backupPath
    })
  }

  public async resetConfig(ideId: string): Promise<void> {
    const backups = await this.listBackups(ideId)
    const latest = backups[0]
    if (!latest) {
      throw new Error('No backups found for this IDE.')
    }

    await this.restoreBackup(ideId, latest.backupPath)
  }

  public async listBackups(ideId: string): Promise<IDEBackup[]> {
    const backups = store.get('ideBackups', []) as IDEBackup[]
    const pruned: IDEBackup[] = []

    for (const backup of backups) {
      const exists = await this.backupExists(backup.backupPath)
      if (exists) {
        pruned.push(backup)
      }
    }

    if (pruned.length !== backups.length) {
      store.set('ideBackups', pruned)
      logger.info('ide', 'Pruned stale IDE backup metadata', {
        removed: backups.length - pruned.length
      })
    }

    return pruned
      .filter((backup) => backup.ideId === ideId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  public async restoreBackup(ideId: string, backupPath: string): Promise<void> {
    const ides = store.get('ides', []) as IDE[]
    const ide = ides.find((entry) => entry.id === ideId)
    if (!ide) {
      throw new Error('IDE not found.')
    }

    const writer = this.getWriterForIDE(ide)
    await writer.restore(ide.configFilePath, backupPath)

    store.set(
      'ides',
      ides.map((entry) =>
        entry.id === ideId
          ? {
              ...entry,
              configuredByQuickl: false,
              currentProviderId: null
            }
          : entry
      )
    )

    logger.info('ide', 'IDE backup restored', {
      ideId,
      backupPath,
      filePath: ide.configFilePath
    })
  }

  private async requireProvider(providerId: string): Promise<Provider> {
    const providers = await providerService.list()
    const provider = providers.find((entry) => entry.id === providerId)
    if (!provider) {
      throw new Error('Provider not found.')
    }
    return provider
  }

  private getWriterForIDE(ide: IDE): ConfigWriter {
    if (ide.type === 'vscode' && ide.configFilePath.toLowerCase().includes('.continue')) {
      return new ContinueConfigWriter()
    }

    if (ide.type === 'vscode' && ide.configFilePath.toLowerCase().endsWith('mcp.json')) {
      return new MCPConfigWriter()
    }

    return new SettingsConfigWriter()
  }
}

export const ideService = new IDEService()
