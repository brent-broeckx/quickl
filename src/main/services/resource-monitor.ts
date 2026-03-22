import { BrowserWindow } from 'electron'
import os from 'node:os'
import { spawn } from 'node:child_process'
import { logger } from '@main/lib/logger'
import type { ResourceStats } from '@shared/types'

type VramStats = {
  vramTotalMb: number | null
  vramUsedMb: number | null
}

function clampPercentage(value: number): number {
  if (Number.isNaN(value)) {
    return 0
  }

  return Math.max(0, Math.min(100, Math.round(value)))
}

function bytesToMb(value: number): number {
  return Math.round((value / (1024 * 1024)) * 100) / 100
}

function runCommand(command: string, args: string[], timeoutMs: number): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe']
    })

    let stdout = ''
    let stderr = ''
    let settled = false

    const finalize = (result: { stdout: string; stderr: string; code: number | null }, shouldReject = false): void => {
      if (settled) {
        return
      }

      settled = true
      if (shouldReject) {
        reject(new Error(result.stderr || `${command} failed`))
      } else {
        resolve(result)
      }
    }

    const timeout = setTimeout(() => {
      child.kill('SIGTERM')
      finalize({ stdout, stderr: `${command} timed out`, code: null }, true)
    }, timeoutMs)

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
    })

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    child.on('error', (error) => {
      clearTimeout(timeout)
      finalize({ stdout, stderr: error.message, code: null }, true)
    })

    child.on('close', (code) => {
      clearTimeout(timeout)
      if (code !== 0) {
        finalize({ stdout, stderr, code }, true)
        return
      }

      finalize({ stdout, stderr, code })
    })
  })
}

async function readNvidiaVram(): Promise<VramStats | null> {
  try {
    const result = await runCommand(
      'nvidia-smi',
      ['--query-gpu=memory.total,memory.used', '--format=csv,noheader,nounits'],
      3000
    )

    const firstLine = result.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean)

    if (!firstLine) {
      return null
    }

    const [totalRaw, usedRaw] = firstLine.split(',').map((entry) => Number.parseFloat(entry.trim()))
    if (!Number.isFinite(totalRaw) || !Number.isFinite(usedRaw)) {
      return null
    }

    return {
      vramTotalMb: totalRaw,
      vramUsedMb: usedRaw
    }
  } catch {
    return null
  }
}

async function readAppleSiliconVram(): Promise<VramStats | null> {
  try {
    const result = await runCommand('ioreg', ['-r', '-d', '1', '-n', 'AGXAccelerator'], 3000)
    const output = result.stdout

    const totalMatch = output.match(/"Total"\s*=\s*(\d+)/i)
    const usedMatch = output.match(/"Agx"\s*=\s*(\d+)/i)

    if (!totalMatch?.[1] || !usedMatch?.[1]) {
      return null
    }

    const totalBytes = Number.parseFloat(totalMatch[1])
    const usedBytes = Number.parseFloat(usedMatch[1])
    if (!Number.isFinite(totalBytes) || !Number.isFinite(usedBytes)) {
      return null
    }

    return {
      vramTotalMb: bytesToMb(totalBytes),
      vramUsedMb: bytesToMb(usedBytes)
    }
  } catch {
    return null
  }
}

async function readAmdVram(): Promise<VramStats | null> {
  try {
    const result = await runCommand('rocm-smi', ['--showmeminfo', 'vram', '--json'], 3000)
    const parsed = JSON.parse(result.stdout) as Record<string, unknown>

    const firstGpu = Object.values(parsed).find(
      (entry) => entry && typeof entry === 'object'
    ) as Record<string, unknown> | undefined

    if (!firstGpu) {
      return null
    }

    const total = Object.values(firstGpu).find(
      (entry) => typeof entry === 'string' && /total/i.test(entry)
    )
    const used = Object.values(firstGpu).find(
      (entry) => typeof entry === 'string' && /used/i.test(entry)
    )

    const totalBytes = typeof total === 'string' ? Number.parseFloat(total.replace(/[^\d.]/g, '')) : Number.NaN
    const usedBytes = typeof used === 'string' ? Number.parseFloat(used.replace(/[^\d.]/g, '')) : Number.NaN

    if (!Number.isFinite(totalBytes) || !Number.isFinite(usedBytes)) {
      return null
    }

    return {
      vramTotalMb: bytesToMb(totalBytes),
      vramUsedMb: bytesToMb(usedBytes)
    }
  } catch {
    return null
  }
}

export class ResourceMonitor {
  private pollTimer: NodeJS.Timeout | null = null

  public async getStats(): Promise<ResourceStats> {
    try {
      const ramTotalMb = bytesToMb(os.totalmem())
      const ramUsedMb = bytesToMb(os.totalmem() - os.freemem())

      const load = os.loadavg()[0] ?? 0
      const cores = os.cpus()?.length ?? 1
      const cpuPercent = clampPercentage((load / Math.max(cores, 1)) * 100)

      const nvidia = await readNvidiaVram()
      const apple = nvidia ? null : await readAppleSiliconVram()
      const amd = nvidia || apple ? null : await readAmdVram()
      const vram = nvidia ?? apple ?? amd

      return {
        ramTotalMb,
        ramUsedMb,
        vramTotalMb: vram?.vramTotalMb ?? null,
        vramUsedMb: vram?.vramUsedMb ?? null,
        cpuPercent
      }
    } catch (error) {
      logger.warn('model', 'Failed to collect resource stats', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      return {
        ramTotalMb: bytesToMb(os.totalmem()),
        ramUsedMb: bytesToMb(os.totalmem() - os.freemem()),
        vramTotalMb: null,
        vramUsedMb: null,
        cpuPercent: 0
      }
    }
  }

  public startPolling(windowRef: BrowserWindow): void {
    this.stopPolling()

    const publish = async (): Promise<void> => {
      const stats = await this.getStats()
      if (!windowRef.isDestroyed()) {
        windowRef.webContents.send('quickl:resource-stats', stats)
      }
    }

    void publish()
    this.pollTimer = setInterval(() => {
      void publish()
    }, 5000)
  }

  public stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
  }
}

export const resourceMonitor = new ResourceMonitor()
