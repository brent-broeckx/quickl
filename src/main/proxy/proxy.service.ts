import net from 'node:net'
import { BrowserWindow } from 'electron'
import type { ProxyStatus } from '@shared/types'
import { logger } from '@main/lib/logger'
import { store } from '@main/lib/store'
import { providerProxy } from '@main/proxy/provider-proxy'
import { mcpAggregator } from '@main/proxy/mcp-aggregator'

function emitPortConflict(payload: { port: number; service: 'provider' | 'mcp' }): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('quickl:proxy-port-conflict', payload)
  }
}

async function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket()
    socket.setTimeout(500)

    socket.once('connect', () => {
      socket.destroy()
      resolve(true)
    })

    socket.once('timeout', () => {
      socket.destroy()
      resolve(false)
    })

    socket.once('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'ECONNREFUSED') {
        resolve(false)
        return
      }

      resolve(true)
    })

    socket.connect(port, '127.0.0.1')
  })
}

export class ProxyService {
  public async start(): Promise<void> {
    const ports = this.getPorts()

    const providerPortInUse = await isPortInUse(ports.providerPort)
    if (providerPortInUse) {
      logger.error('proxy', 'Provider proxy port conflict', { port: ports.providerPort })
      emitPortConflict({ port: ports.providerPort, service: 'provider' })
    } else {
      await providerProxy.start(ports.providerPort)
    }

    const mcpPortInUse = await isPortInUse(ports.mcpPort)
    if (mcpPortInUse) {
      logger.error('proxy', 'MCP aggregator port conflict', { port: ports.mcpPort })
      emitPortConflict({ port: ports.mcpPort, service: 'mcp' })
    } else {
      await mcpAggregator.start(ports.mcpPort)
    }

    if (providerProxy.isRunning() && mcpAggregator.isRunning()) {
      logger.info('proxy', 'Both proxies are running', {
        providerPort: ports.providerPort,
        mcpPort: ports.mcpPort
      })
    }
  }

  public async stop(): Promise<void> {
    await Promise.all([providerProxy.stop(5000), mcpAggregator.stop(5000)])
  }

  public async restart(): Promise<void> {
    await this.stop()
    await this.start()
  }

  public getPorts(): { providerPort: number; mcpPort: number } {
    const proxySettings = store.get('settings.proxy', { providerPort: 3820, mcpPort: 3821 })
    return {
      providerPort: proxySettings.providerPort,
      mcpPort: proxySettings.mcpPort
    }
  }

  public setPorts(ports: { providerPort: number; mcpPort: number }): void {
    store.set('settings.proxy', ports)
  }

  public getStatus(): ProxyStatus {
    return {
      providerProxy: {
        port: providerProxy.getPort(),
        running: providerProxy.isRunning(),
        requestCount: providerProxy.getRequestCount()
      },
      mcpAggregator: {
        port: mcpAggregator.getPort(),
        running: mcpAggregator.isRunning(),
        connectedClients: mcpAggregator.getConnectedClients().length
      }
    }
  }
}

export const proxyService = new ProxyService()
