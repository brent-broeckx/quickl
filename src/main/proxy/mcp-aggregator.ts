import { BrowserWindow } from 'electron'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { randomUUID } from 'node:crypto'
import type { ConnectedMCPClient } from '@shared/types'
import { logger } from '@main/lib/logger'

type JsonRpcRequest = {
  jsonrpc?: string
  id?: string | number | null
  method?: string
  params?: {
    clientInfo?: {
      name?: string
      version?: string
    }
    [key: string]: unknown
  }
}

type SSEClient = {
  id: string
  response: ServerResponse
  keepalive: NodeJS.Timeout
}

function jsonRpcError(id: string | number | null | undefined, code: number, message: string): Record<string, unknown> {
  return {
    jsonrpc: '2.0',
    id: id ?? null,
    error: {
      code,
      message
    }
  }
}

function writeJson(res: ServerResponse, status: number, payload: Record<string, unknown>): void {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(payload))
}

async function readJsonBody(req: IncomingMessage): Promise<JsonRpcRequest> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []

    req.on('data', (chunk: Buffer) => {
      chunks.push(chunk)
    })

    req.on('end', () => {
      if (chunks.length === 0) {
        resolve({})
        return
      }

      try {
        const raw = Buffer.concat(chunks).toString('utf8')
        resolve(JSON.parse(raw) as JsonRpcRequest)
      } catch {
        reject(new Error('Invalid JSON body'))
      }
    })

    req.on('error', reject)
  })
}

function sendSSEData(res: ServerResponse, payload: Record<string, unknown>): void {
  res.write(`data: ${JSON.stringify(payload)}\n\n`)
}

export class MCPAggregator {
  private server: Server | null = null
  private running = false
  private port = 3821
  private inFlightRequests = 0
  private readonly connectedClients = new Map<string, ConnectedMCPClient>()
  private readonly sseClients = new Map<string, SSEClient>()

  public isRunning(): boolean {
    return this.running
  }

  public getPort(): number {
    return this.port
  }

  public getConnectedClients(): ConnectedMCPClient[] {
    return [...this.connectedClients.values()]
  }

  public async start(port: number): Promise<void> {
    if (this.running) {
      return
    }

    this.port = port

    this.server = createServer((req, res) => {
      void this.handleRequest(req, res)
    })

    await new Promise<void>((resolve, reject) => {
      this.server?.once('error', reject)
      this.server?.listen(this.port, '127.0.0.1', () => {
        this.server?.off('error', reject)
        this.running = true
        resolve()
      })
    })

    logger.info('proxy', 'MCP aggregator started', { port: this.port })
  }

  public async stop(timeoutMs = 5000): Promise<void> {
    if (!this.server) {
      this.running = false
      return
    }

    const startedAt = Date.now()
    while (this.inFlightRequests > 0 && Date.now() - startedAt < timeoutMs) {
      await new Promise((resolve) => setTimeout(resolve, 50))
    }

    for (const sseClient of this.sseClients.values()) {
      clearInterval(sseClient.keepalive)
      sseClient.response.end()
    }
    this.sseClients.clear()

    await new Promise<void>((resolve, reject) => {
      this.server?.close((error) => {
        if (error) {
          reject(error)
          return
        }

        resolve()
      })
    })

    this.server = null
    this.running = false
    logger.info('proxy', 'MCP aggregator stopped')
  }

  public async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    this.inFlightRequests += 1

    try {
      const method = req.method ?? 'GET'
      const path = (req.url ?? '').split('?')[0]

      if (method === 'POST' && path === '/mcp') {
        const message = await readJsonBody(req)
        const payload = this.processJsonRpc(message, 'http')
        writeJson(res, 200, payload)
        return
      }

      if (method === 'GET' && path === '/sse') {
        this.handleSSEConnect(req, res)
        return
      }

      if (method === 'POST' && path === '/sse/message') {
        const message = await readJsonBody(req)
        const payload = this.processJsonRpc(message, 'sse')
        for (const client of this.sseClients.values()) {
          sendSSEData(client.response, payload)
        }

        writeJson(res, 200, { ok: true })
        return
      }

      writeJson(res, 404, { error: 'Not found' })
    } catch (error) {
      if (!res.headersSent) {
        if (error instanceof Error && error.message === 'Invalid JSON body') {
          writeJson(res, 400, jsonRpcError(null, -32700, 'Parse error'))
        } else {
          writeJson(res, 500, jsonRpcError(null, -32603, 'Internal error'))
        }
      }

      logger.error('proxy', 'MCP aggregator request failed', {
        error: error instanceof Error ? error.message : String(error)
      })
    } finally {
      this.inFlightRequests = Math.max(0, this.inFlightRequests - 1)
    }
  }

  public processJsonRpc(message: JsonRpcRequest, transport: 'http' | 'sse'): Record<string, unknown> {
    const method = message.method
    const id = message.id ?? null

    if (method === 'initialize') {
      const name = message.params?.clientInfo?.name ?? 'unknown-client'
      const version = message.params?.clientInfo?.version ?? 'unknown'
      const client = this.addClient(name, version, transport)

      for (const window of BrowserWindow.getAllWindows()) {
        window.webContents.send('quickl:mcp-client-connected', client)
      }

      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'quickl-aggregator', version: '1.0.0' }
        }
      }
    }

    if (method === 'tools/list') {
      return {
        jsonrpc: '2.0',
        id,
        result: { tools: [] }
      }
    }

    if (method === 'tools/call') {
      return jsonRpcError(id, -32601, 'No MCP servers configured yet')
    }

    return jsonRpcError(id, -32601, 'Method not found')
  }

  private handleSSEConnect(req: IncomingMessage, res: ServerResponse): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      Connection: 'keep-alive',
      'Cache-Control': 'no-cache'
    })

    sendSSEData(res, { type: 'connected', aggregatorVersion: '1.0.0' })

    const id = randomUUID()
    const keepalive = setInterval(() => {
      res.write(': keepalive\n\n')
    }, 30_000)

    this.sseClients.set(id, {
      id,
      response: res,
      keepalive
    })

    const client = this.addClient('sse-client', 'unknown', 'sse', id)
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send('quickl:mcp-client-connected', client)
    }

    req.on('close', () => {
      clearInterval(keepalive)
      this.sseClients.delete(id)
      this.connectedClients.delete(client.id)
    })
  }

  private addClient(name: string, version: string, transport: 'http' | 'sse', forcedId?: string): ConnectedMCPClient {
    const client: ConnectedMCPClient = {
      id: forcedId ?? randomUUID(),
      name,
      version,
      transport,
      connectedAt: new Date().toISOString()
    }

    this.connectedClients.set(client.id, client)
    return client
  }
}

export const mcpAggregator = new MCPAggregator()
