import { EventEmitter } from 'node:events'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MCPAggregator } from '@main/proxy/mcp-aggregator'

const mocks = vi.hoisted(() => ({
  sendMock: vi.fn(),
  infoMock: vi.fn(),
  errorMock: vi.fn()
}))

vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: () => [
      {
        webContents: {
          send: mocks.sendMock
        }
      }
    ]
  }
}))

vi.mock('@main/lib/logger', () => ({
  logger: {
    info: mocks.infoMock,
    error: mocks.errorMock,
    debug: vi.fn(),
    warn: vi.fn()
  }
}))

type MockReq = EventEmitter & {
  method?: string
  url?: string
}

type MockRes = {
  headersSent: boolean
  writeHead: ReturnType<typeof vi.fn>
  end: ReturnType<typeof vi.fn>
  write: ReturnType<typeof vi.fn>
}

function createRequest(method: string, url: string, body?: unknown): MockReq {
  const req = new EventEmitter() as MockReq
  req.method = method
  req.url = url

  process.nextTick(() => {
    if (body !== undefined) {
      req.emit('data', Buffer.from(JSON.stringify(body)))
    }
    req.emit('end')
  })

  return req
}

function createResponse(): MockRes {
  return {
    headersSent: false,
    writeHead: vi.fn(),
    end: vi.fn(function end(this: MockRes): void {
      this.headersSent = true
    }),
    write: vi.fn()
  }
}

describe('MCPAggregator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('initialize returns protocol version and server info', () => {
    const aggregator = new MCPAggregator()

    const response = aggregator.processJsonRpc(
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { clientInfo: { name: 'test-client', version: '1.0.0' } }
      },
      'http'
    )

    expect(response).toMatchObject({
      jsonrpc: '2.0',
      id: 1,
      result: {
        protocolVersion: '2024-11-05',
        serverInfo: { name: 'quickl-aggregator', version: '1.0.0' }
      }
    })
  })

  it('initialize stores connected client info', () => {
    const aggregator = new MCPAggregator()

    aggregator.processJsonRpc(
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { clientInfo: { name: 'client-a', version: '2.1.0' } }
      },
      'http'
    )

    expect(aggregator.getConnectedClients()).toHaveLength(1)
    expect(aggregator.getConnectedClients()[0]).toMatchObject({
      name: 'client-a',
      version: '2.1.0',
      transport: 'http'
    })
  })

  it('tools/list returns empty array in phase 3', () => {
    const aggregator = new MCPAggregator()

    const response = aggregator.processJsonRpc(
      { jsonrpc: '2.0', id: 2, method: 'tools/list' },
      'http'
    )

    expect(response).toMatchObject({
      jsonrpc: '2.0',
      id: 2,
      result: { tools: [] }
    })
  })

  it('unknown method returns method not found', () => {
    const aggregator = new MCPAggregator()

    const response = aggregator.processJsonRpc(
      { jsonrpc: '2.0', id: 3, method: 'not-real' },
      'http'
    ) as { error: { code: number; message: string } }

    expect(response.error.code).toBe(-32601)
    expect(response.error.message).toBe('Method not found')
  })

  it('SSE connection sends connected event immediately', async () => {
    const aggregator = new MCPAggregator()
    const req = createRequest('GET', '/sse')
    const res = createResponse()

    await aggregator.handleRequest(req as never, res as never)

    expect(res.writeHead).toHaveBeenCalledWith(
      200,
      expect.objectContaining({ 'Content-Type': 'text/event-stream' })
    )
    expect(res.write).toHaveBeenCalledWith(expect.stringContaining('connected'))
  })
})
