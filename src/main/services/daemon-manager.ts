import { spawn } from 'node:child_process'
import os from 'node:os'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import fetch, { AbortError } from 'node-fetch'
import { logger } from '@main/lib/logger'

type OllamaStatus = 'running' | 'stopped' | 'not-installed'

const OLLAMA_TAGS_URL = 'http://localhost:11434/api/tags'

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<boolean> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal
    })

    return response.ok
  } catch (error) {
    if (error instanceof AbortError) {
      return false
    }

    return false
  } finally {
    clearTimeout(timeout)
  }
}

function runExistsCommand(command: string, args: string[]): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: os.platform() === 'win32'
    })

    let output = ''
    child.stdout.on('data', (chunk) => {
      output += chunk.toString()
    })

    child.stderr.on('data', (chunk) => {
      output += chunk.toString()
    })

    const timeout = setTimeout(() => {
      child.kill('SIGTERM')
      resolve(false)
    }, 1500)

    child.on('error', () => {
      clearTimeout(timeout)
      resolve(false)
    })
    child.on('close', (code) => {
      clearTimeout(timeout)
      resolve(code === 0 && output.trim().length > 0)
    })
  })
}

function readLikelyWindowsOllamaPaths(): string[] {
  const localAppData = process.env.LOCALAPPDATA ?? ''
  const programFiles = process.env.ProgramFiles ?? ''
  const programFilesX86 = process.env['ProgramFiles(x86)'] ?? ''

  return [
    join(localAppData, 'Programs', 'Ollama', 'ollama.exe'),
    join(programFiles, 'Ollama', 'ollama.exe'),
    join(programFilesX86, 'Ollama', 'ollama.exe')
  ].filter((entry) => entry.length > 0)
}

export class DaemonManager {
  private spawnedOllamaPid: number | null = null

  private async resolveOllamaExecutable(): Promise<string | null> {
    if (os.platform() === 'win32') {
      for (const candidate of readLikelyWindowsOllamaPaths()) {
        if (existsSync(candidate)) {
          return candidate
        }
      }
    }

    const commandChecks = os.platform() === 'win32'
      ? [
          runExistsCommand('where.exe', ['ollama']),
          runExistsCommand('cmd', ['/c', 'where ollama']),
          runExistsCommand('powershell', ['-NoProfile', '-Command', 'Get-Command ollama'])
        ]
      : [runExistsCommand('which', ['ollama'])]

    for (const check of commandChecks) {
      if (await check) {
        return 'ollama'
      }
    }

    return null
  }

  public async isOllamaInstalled(): Promise<boolean> {
    return (await this.resolveOllamaExecutable()) !== null
  }

  public async isOllamaRunning(): Promise<boolean> {
    return await fetchWithTimeout(OLLAMA_TAGS_URL, 1000)
  }

  public async startOllama(): Promise<void> {
    const executable = await this.resolveOllamaExecutable()
    if (!executable) {
      throw new Error('Ollama is not installed')
    }

    const alreadyRunning = await this.isOllamaRunning()
    if (alreadyRunning) {
      logger.info('system', 'Ollama is already running')
      return
    }

    const child = spawn(executable, ['serve'], {
      detached: true,
      stdio: 'ignore',
      shell: os.platform() === 'win32' && executable === 'ollama'
    })

    this.spawnedOllamaPid = child.pid ?? null
    child.unref()

    const start = Date.now()
    while (Date.now() - start < 5000) {
      if (await this.isOllamaRunning()) {
        logger.info('system', 'Ollama started successfully')
        return
      }

      await new Promise((resolve) => setTimeout(resolve, 500))
    }

    throw new Error('Ollama failed to start within 5 seconds')
  }

  public async getOllamaStatus(): Promise<OllamaStatus> {
    const running = await this.isOllamaRunning()
    if (running) {
      return 'running'
    }

    const installed = await this.isOllamaInstalled()
    return installed ? 'stopped' : 'not-installed'
  }

  public stopManagedOllama(): void {
    if (!this.spawnedOllamaPid) {
      return
    }

    try {
      process.kill(this.spawnedOllamaPid, 'SIGTERM')
      logger.info('system', 'Stopped Quickl-managed Ollama process', {
        pid: this.spawnedOllamaPid
      })
    } catch {
      // Process may already be terminated.
    } finally {
      this.spawnedOllamaPid = null
    }
  }
}

export const daemonManager = new DaemonManager()
