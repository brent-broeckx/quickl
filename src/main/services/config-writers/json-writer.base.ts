import { mkdir, readFile, rename, writeFile, unlink } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { ConfigPatch, ConfigWriter, ProxyConfig, WriterContext } from '@main/services/config-writers/types'

const INDENT = 2

type BackupSnapshot = {
  format: 'quickl-backup-v1'
  existed: boolean
  content: string | null
}

export abstract class BaseJsonConfigWriter implements ConfigWriter {
  public async read(filePath: string): Promise<unknown> {
    try {
      const raw = await readFile(filePath, 'utf-8')
      return this.parse(raw)
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code === 'ENOENT') {
        return {}
      }

      throw error
    }
  }

  public abstract generatePatch(current: unknown, proxyConfig: ProxyConfig, context: WriterContext): ConfigPatch

  public async apply(filePath: string, patch: ConfigPatch): Promise<void> {
    await mkdir(dirname(filePath), { recursive: true })
    const tempPath = `${filePath}.quickl.tmp`
    await writeFile(tempPath, patch.after, 'utf-8')
    await rename(tempPath, filePath)
  }

  public async backup(filePath: string): Promise<string> {
    let existed = true
    let content: string | null = null

    try {
      content = await readFile(filePath, 'utf-8')
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code === 'ENOENT') {
        existed = false
      } else {
        throw error
      }
    }

    const backupDir = join(dirname(filePath), '.quickl-backups')
    await mkdir(backupDir, { recursive: true })
    const backupPath = join(
      backupDir,
      `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.quickl-backup.json`
    )

    const snapshot: BackupSnapshot = {
      format: 'quickl-backup-v1',
      existed,
      content
    }

    await writeFile(backupPath, JSON.stringify(snapshot), 'utf-8')
    return backupPath
  }

  public async restore(filePath: string, backupPath: string): Promise<void> {
    const backupRaw = await readFile(backupPath, 'utf-8')
    const snapshot = this.parseBackupSnapshot(backupRaw)

    if (snapshot) {
      if (!snapshot.existed) {
        try {
          await unlink(filePath)
        } catch (error) {
          const code = (error as NodeJS.ErrnoException).code
          if (code !== 'ENOENT') {
            throw error
          }
        }
        return
      }

      await mkdir(dirname(filePath), { recursive: true })
      const tempPath = `${filePath}.quickl.restore.tmp`
      await writeFile(tempPath, snapshot.content ?? '', 'utf-8')
      await rename(tempPath, filePath)
      return
    }

    // Backward compatibility with first implementation that copied raw file content.
    await mkdir(dirname(filePath), { recursive: true })
    const tempPath = `${filePath}.quickl.restore.tmp`
    await writeFile(tempPath, backupRaw, 'utf-8')
    await rename(tempPath, filePath)
  }

  private parseBackupSnapshot(raw: string): BackupSnapshot | null {
    try {
      const parsed = JSON.parse(raw) as Partial<BackupSnapshot>
      if (parsed.format !== 'quickl-backup-v1') {
        return null
      }

      if (typeof parsed.existed !== 'boolean') {
        return null
      }

      if (parsed.content !== null && typeof parsed.content !== 'string') {
        return null
      }

      return {
        format: 'quickl-backup-v1',
        existed: parsed.existed,
        content: parsed.content ?? null
      }
    } catch {
      return null
    }
  }

  protected parse(raw: string): Record<string, unknown> {
    const trimmed = raw.trim()
    if (!trimmed) {
      return {}
    }

    try {
      const parsed = JSON.parse(trimmed) as unknown
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>
      }
      return {}
    } catch {
      // Some editors allow JSON with comments/trailing commas. Failing safe keeps writes explicit.
      return {}
    }
  }

  protected stringify(value: unknown): string {
    return `${JSON.stringify(value, null, INDENT)}\n`
  }
}
