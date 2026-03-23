import { EventEmitter } from 'node:events'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ProviderProxy } from '@main/proxy/provider-proxy'
import type { Provider } from '@shared/types'

const mocks = vi.hoisted(() => ({
  listMock: vi.fn(),
  getRawKeyMock: vi.fn(),
  fetchMock: vi.fn(),
  openaiTranslateRequestMock: vi.fn(),
  openaiTranslateResponseMock: vi.fn(),
  anthropicTranslateRequestMock: vi.fn(),
  anthropicTranslateResponseMock: vi.fn(),
  errorMock: vi.fn(),
  debugMock: vi.fn()
}))

vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: () => []
  }
}))

vi.mock('@main/lib/store', () => ({
  store: {
    get: vi.fn().mockReturnValue([])
  }
}))

vi.mock('@main/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: mocks.errorMock,
    debug: mocks.debugMock
  }
}))

vi.mock('@main/services/provider.service', () => ({
  providerService: {
    list: mocks.listMock,
    getRawKey: mocks.getRawKeyMock
  }
}))

vi.mock('node-fetch', () => ({
  default: mocks.fetchMock
}))

vi.mock('@main/proxy/translators/openai.translator', () => ({
  translateRequest: mocks.openaiTranslateRequestMock,
  translateResponse: mocks.openaiTranslateResponseMock
}))

vi.mock('@main/proxy/translators/anthropic.translator', () => ({
  translateRequest: mocks.anthropicTranslateRequestMock,
  translateResponse: mocks.anthropicTranslateResponseMock
}))

vi.mock('@main/proxy/translators/google.translator', () => ({
  translateRequest: vi.fn(),
  translateResponse: vi.fn()
}))

vi.mock('@main/proxy/translators/passthrough.translator', () => ({
  translateRequest: vi.fn(),
  translateResponse: vi.fn()
}))

type MockReq = EventEmitter & {
  method?: string
  url?: string
}

type MockRes = {
  headersSent: boolean
  writeHead: ReturnType<typeof vi.fn>
  end: ReturnType<typeof vi.fn>
}

function buildProvider(overrides?: Partial<Provider>): Provider {
  return {
    id: 'provider-1',
    name: 'openai',
    type: 'cloud',
    baseUrl: 'https://api.openai.com',
    authType: 'api-key',
    keychainKey: null,
    enabled: true,
    defaultModel: null,
    status: 'online',
    lastLatencyMs: null,
    lastChecked: null,
    createdAt: new Date().toISOString(),
    ...overrides
  }
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
    })
  }
}

describe('ProviderProxy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.openaiTranslateRequestMock.mockReturnValue({
      url: 'https://api.openai.com/v1/chat/completions',
      method: 'POST',
      headers: { Authorization: 'Bearer secret', 'Content-Type': 'application/json' },
      body: '{}'
    })
    mocks.openaiTranslateResponseMock.mockResolvedValue({
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ok: true })
    })
    mocks.anthropicTranslateRequestMock.mockReturnValue({
      url: 'https://api.anthropic.com/v1/messages',
      method: 'POST',
      headers: { 'x-api-key': 'secret', 'Content-Type': 'application/json' },
      body: '{}'
    })
    mocks.anthropicTranslateResponseMock.mockResolvedValue({
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ok: true })
    })
    mocks.fetchMock.mockResolvedValue({
      status: 200,
      headers: { forEach: vi.fn() },
      text: vi.fn().mockResolvedValue('{}')
    })
  })

  it('routes unknown paths to 404', async () => {
    const proxy = new ProviderProxy()
    const req = createRequest('GET', '/nope')
    const res = createResponse()

    await proxy.handleRequest(req as never, res as never)

    expect(res.writeHead).toHaveBeenCalledWith(404, { 'Content-Type': 'application/json' })
  })

  it('returns 503 when no active provider configured', async () => {
    mocks.listMock.mockResolvedValue([])
    const proxy = new ProviderProxy()
    const req = createRequest('GET', '/v1/models')
    const res = createResponse()

    await proxy.handleRequest(req as never, res as never)

    expect(res.writeHead).toHaveBeenCalledWith(503, { 'Content-Type': 'application/json' })
  })

  it('returns 401 when provider requires key and none found', async () => {
    mocks.listMock.mockResolvedValue([buildProvider()])
    mocks.getRawKeyMock.mockResolvedValue(null)

    const proxy = new ProviderProxy()
    const req = createRequest('POST', '/v1/chat/completions', { model: 'gpt-4o-mini' })
    const res = createResponse()

    await proxy.handleRequest(req as never, res as never)

    expect(res.writeHead).toHaveBeenCalledWith(401, { 'Content-Type': 'application/json' })
  })

  it('calls OpenAI translator for OpenAI provider', async () => {
    mocks.listMock.mockResolvedValue([buildProvider({ name: 'openai' })])
    mocks.getRawKeyMock.mockResolvedValue('secret')

    const proxy = new ProviderProxy()
    const req = createRequest('POST', '/v1/chat/completions', { model: 'gpt-4o-mini' })
    const res = createResponse()

    await proxy.handleRequest(req as never, res as never)

    expect(mocks.openaiTranslateRequestMock).toHaveBeenCalled()
  })

  it('calls Anthropic translator for Anthropic provider', async () => {
    mocks.listMock.mockResolvedValue([buildProvider({ name: 'anthropic', baseUrl: 'https://api.anthropic.com' })])
    mocks.getRawKeyMock.mockResolvedValue('secret')

    const proxy = new ProviderProxy()
    const req = createRequest('POST', '/v1/chat/completions', { model: 'claude-3-5-haiku' })
    const res = createResponse()

    await proxy.handleRequest(req as never, res as never)

    expect(mocks.anthropicTranslateRequestMock).toHaveBeenCalled()
  })

  it('returns 502 on ECONNREFUSED from provider', async () => {
    mocks.listMock.mockResolvedValue([buildProvider({ name: 'openai' })])
    mocks.getRawKeyMock.mockResolvedValue('secret')
    mocks.fetchMock.mockRejectedValueOnce(Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }))

    const proxy = new ProviderProxy()
    const req = createRequest('POST', '/v1/chat/completions', { model: 'gpt-4o-mini' })
    const res = createResponse()

    await proxy.handleRequest(req as never, res as never)

    expect(res.writeHead).toHaveBeenCalledWith(502, { 'Content-Type': 'application/json' })
  })
})
