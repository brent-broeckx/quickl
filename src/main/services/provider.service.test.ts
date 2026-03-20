import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Provider } from '@shared/types'
import { ProviderService } from '@main/services/provider.service'

const mocks = vi.hoisted(() => ({
  getMock: vi.fn(),
  setMock: vi.fn(),
  infoMock: vi.fn(),
  warnMock: vi.fn(),
  getPasswordMock: vi.fn(),
  setPasswordMock: vi.fn(),
  deletePasswordMock: vi.fn(),
  fetchMock: vi.fn()
}))

vi.mock('@main/lib/store', () => {
  return {
    store: {
      get: mocks.getMock,
      set: mocks.setMock
    }
  }
})

vi.mock('@main/lib/logger', () => {
  return {
    logger: {
      info: mocks.infoMock,
      warn: mocks.warnMock,
      error: vi.fn(),
      debug: vi.fn()
    }
  }
})

vi.mock('keytar', () => {
  const mockApi = {
    getPassword: mocks.getPasswordMock,
    setPassword: mocks.setPasswordMock,
    deletePassword: mocks.deletePasswordMock
  }

  return {
    __esModule: true,
    ...mockApi,
    default: mockApi
  }
})

vi.mock('node-fetch', () => {
  return {
    default: mocks.fetchMock
  }
})

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
    status: 'unknown',
    lastLatencyMs: null,
    lastChecked: null,
    createdAt: new Date().toISOString(),
    ...overrides
  }
}

describe('ProviderService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getMock.mockReturnValue([])
  })

  it('add saves provider metadata and does not persist key value', async () => {
    const service = new ProviderService()

    const provider = await service.add({
      name: 'openai',
      baseUrl: 'https://api.openai.com',
      authType: 'api-key'
    })

    expect(provider.id).toBeTruthy()
    expect(mocks.setMock).toHaveBeenCalledTimes(1)
    const savedProviders = mocks.setMock.mock.calls[0][1] as Provider[]
    expect(savedProviders[0].keychainKey).toBeNull()
    expect(JSON.stringify(savedProviders[0])).not.toContain('sk-')
  })

  it('remove updates store and deletes keychain entry', async () => {
    const service = new ProviderService()
    const provider = buildProvider()
    mocks.getMock.mockReturnValue([provider])

    await service.remove(provider.id)

    expect(mocks.setMock).toHaveBeenCalledWith('providers', [])
    expect(mocks.deletePasswordMock).toHaveBeenCalledWith('quickl', provider.id)
  })

  it('getApiKeyHint masks last 4 chars and returns not set fallback', async () => {
    const service = new ProviderService()
    const provider = buildProvider()
    mocks.getMock.mockReturnValue([provider])

    mocks.getPasswordMock.mockResolvedValueOnce('sk-1234567890abcd')
    await expect(service.getApiKeyHint(provider.id)).resolves.toBe('sk-...abcd')

    mocks.getPasswordMock.mockResolvedValueOnce(null)
    await expect(service.getApiKeyHint(provider.id)).resolves.toBe('(not set)')
  })

  it('testConnection returns success on 200 and never throws on network error', async () => {
    const service = new ProviderService()
    const provider = buildProvider()
    mocks.getMock.mockReturnValue([provider])
    mocks.getPasswordMock.mockResolvedValue('sk-live-1')

    mocks.fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ data: [] })
    })

    await expect(service.testConnection(provider.id)).resolves.toMatchObject({ ok: true })

    mocks.fetchMock.mockRejectedValueOnce(
      Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' })
    )
    await expect(service.testConnection(provider.id)).resolves.toMatchObject({
      ok: false,
      error: 'Could not connect'
    })
  })

  it('testConnection sends Anthropic request format differently from OpenAI', async () => {
    const service = new ProviderService()
    const anthropic = buildProvider({
      id: 'p-anthropic',
      name: 'anthropic',
      baseUrl: 'https://api.anthropic.com'
    })

    mocks.getMock.mockReturnValue([anthropic])
    mocks.getPasswordMock.mockResolvedValue('anthropic-key')
    mocks.fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({})
    })

    await service.testConnection('p-anthropic')

    expect(mocks.fetchMock).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/messages',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'x-api-key': 'anthropic-key',
          'anthropic-version': '2023-06-01'
        })
      })
    )

    mocks.fetchMock.mockClear()

    const openai = buildProvider({ id: 'p-openai', name: 'openai', baseUrl: 'https://api.openai.com' })
    mocks.getMock.mockReturnValue([openai])
    await service.testConnection('p-openai')

    expect(mocks.fetchMock).toHaveBeenCalledWith(
      'https://api.openai.com/v1/models',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: 'Bearer anthropic-key' })
      })
    )
  })
})
