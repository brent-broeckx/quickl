import { BrowserWindow, powerMonitor } from 'electron'
import { logger } from '@main/lib/logger'
import { store } from '@main/lib/store'
import { providerService } from '@main/services/provider.service'
import type { Provider } from '@shared/types'

export class HealthPoller {
  private timer: NodeJS.Timeout | null = null
  private paused = false
  private started = false
  private initializedPowerHooks = false
  private intervalSeconds = 30

  private emitStatus(id: string, status: Provider['status'], latencyMs: number | null): void {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send('quickl:provider-status-changed', {
        id,
        status,
        latencyMs
      })
    }
  }

  private async runCycle(): Promise<void> {
    if (this.paused) {
      this.scheduleNextCycle()
      return
    }

    const providers = await providerService.list()
    const enabledProviders = providers.filter((provider) => provider.enabled)

    logger.debug('provider', 'Health poll cycle', {
      count: enabledProviders.length,
      intervalSeconds: this.intervalSeconds
    })

    for (const provider of enabledProviders) {
      const result = await providerService.testConnection(provider.id)
      let status: Provider['status'] = 'offline'
      if (result.ok) {
        status = 'online'
      } else if (result.error === 'Invalid API key') {
        status = 'degraded'
      }

      this.emitStatus(
        provider.id,
        status,
        result.latencyMs
      )
    }

    this.scheduleNextCycle()
  }

  private scheduleNextCycle(): void {
    if (!this.started) {
      return
    }

    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }

    this.timer = setTimeout(() => {
      void this.runCycle()
    }, this.intervalSeconds * 1000)
  }

  private setupPowerHooks(): void {
    if (this.initializedPowerHooks) {
      return
    }

    powerMonitor.on('suspend', () => {
      this.paused = true
      logger.debug('provider', 'Health poller paused (system suspend)')
    })

    powerMonitor.on('resume', () => {
      this.paused = false
      logger.debug('provider', 'Health poller resumed (system resume)')
    })

    this.initializedPowerHooks = true
  }

  public start(): void {
    this.setupPowerHooks()
    this.stop()

    this.started = true
    this.intervalSeconds = store.get('settings.healthCheckIntervalSeconds', 30)
    void this.runCycle()
  }

  public stop(): void {
    this.started = false
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  public setInterval(seconds: number): void {
    this.intervalSeconds = Math.max(5, seconds)
  }
}

export const healthPoller = new HealthPoller()
