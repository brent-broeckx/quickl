import keytar from 'keytar'
import fetch from 'node-fetch'
import type { Response as FetchResponse } from 'node-fetch'
import { randomUUID } from 'node:crypto'
import { store } from '@main/lib/store'
import { logger } from '@main/lib/logger'
import type { AddProviderInput, Provider } from '@shared/types'

type ConnectionResult = { ok: boolean; latencyMs: number; error?: string }

type JsonLike = Record<string, unknown>

const KEYCHAIN_SERVICE_NAME = 'quickl'

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '')
}

function isCloudPreset(name: string): boolean {
  const normalized = name.trim().toLowerCase()
  return ['openai', 'anthropic', 'google', 'google gemini', 'mistral', 'groq'].includes(normalized)
}

function mapHttpErrorMessage(status: number): string {
  if (status === 401) {
    return 'Invalid API key'
  }

  if (status === 404) {
    return 'Endpoint not found'
  }

  if (status >= 500) {
    return 'Provider service is unavailable'
  }

  return `Request failed with status ${status}`
}

function mapNetworkError(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'Could not connect'
  }

  const code = (error as Error & { code?: string }).code
  if (code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'EHOSTUNREACH') {
    return 'Could not connect'
  }

  if (/fetch failed|network|socket|connect|timeout/i.test(error.message)) {
    return 'Could not connect'
  }

  return error.message || 'Could not connect'
}

function providerKind(provider: Provider): string {
  return provider.name.trim().toLowerCase()
}

export class ProviderService {
  private getProviders(): Provider[] {
    return store.get('providers', [])
  }

  private setProviders(providers: Provider[]): void {
    store.set('providers', providers)
  }

  private findProvider(id: string): Provider {
    const provider = this.getProviders().find((entry) => entry.id === id)
    if (!provider) {
      throw new Error('Provider not found')
    }

    return provider
  }

  private async getStoredApiKey(provider: Provider): Promise<string | null> {
    if (provider.authType !== 'api-key' && provider.authType !== 'bearer') {
      return null
    }

    return keytar.getPassword(KEYCHAIN_SERVICE_NAME, provider.id)
  }

  private async readJsonSafely(response: FetchResponse): Promise<JsonLike> {
    try {
      return (await response.json()) as JsonLike
    } catch {
      return {}
    }
  }

  private async requestModels(provider: Provider): Promise<{ response: FetchResponse; payload: JsonLike }> {
    const kind = providerKind(provider)
    const baseUrl = normalizeBaseUrl(provider.baseUrl)
    const apiKey = await this.getStoredApiKey(provider)
    const headers: Record<string, string> = {}

    if (
      apiKey &&
      (kind === 'openai' || kind === 'mistral' || kind === 'groq' || kind === 'lmstudio' || kind === 'vllm' || kind === 'custom')
    ) {
      headers.Authorization = `Bearer ${apiKey}`
    }

    if (kind === 'anthropic') {
      const response = await fetch(`${baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey || '',
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-5-haiku-latest',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'ping' }]
        })
      })
      return { response, payload: await this.readJsonSafely(response) }
    }

    if (kind === 'google' || kind === 'google gemini') {
      const response = await fetch(`${baseUrl}/v1beta/models?key=${encodeURIComponent(apiKey || '')}`, {
        method: 'GET'
      })
      return { response, payload: await this.readJsonSafely(response) }
    }

    if (kind === 'ollama') {
      const response = await fetch(`${baseUrl}/api/tags`, { method: 'GET' })
      return { response, payload: await this.readJsonSafely(response) }
    }

    if (kind === 'lm studio') {
      const response = await fetch(`${baseUrl}/v1/models`, { method: 'GET' })
      return { response, payload: await this.readJsonSafely(response) }
    }

    if (kind === 'jan') {
      const response = await fetch(`${baseUrl}/v1/models`, { method: 'GET' })
      return { response, payload: await this.readJsonSafely(response) }
    }

    const response = await fetch(`${baseUrl}/v1/models`, {
      method: 'GET',
      headers
    })
    return { response, payload: await this.readJsonSafely(response) }
  }

  private updateProviderRuntime(
    id: string,
    patch: Partial<Provider> & { lastChecked?: string }
  ): Provider | null {
    const providers = this.getProviders()
    const index = providers.findIndex((entry) => entry.id === id)
    if (index === -1) {
      return null
    }

    const updated = {
      ...providers[index],
      ...patch
    }

    providers[index] = updated
    this.setProviders(providers)

    return updated
  }

  public async list(): Promise<Provider[]> {
    return this.getProviders()
  }

  public async add(config: AddProviderInput): Promise<Provider> {
    if (!config.name?.trim()) {
      throw new Error('Provider name is required')
    }

    if (!config.baseUrl?.trim()) {
      throw new Error('Base URL is required')
    }

    if (!config.authType) {
      throw new Error('Authentication type is required')
    }

    const provider: Provider = {
      id: randomUUID(),
      name: config.name.trim(),
      type: config.type || (isCloudPreset(config.name) ? 'cloud' : 'local'),
      baseUrl: normalizeBaseUrl(config.baseUrl),
      authType: config.authType,
      keychainKey: null,
      enabled: config.enabled ?? true,
      defaultModel: config.defaultModel ?? null,
      status: 'unknown',
      lastLatencyMs: null,
      lastChecked: null,
      createdAt: new Date().toISOString()
    }

    const providers = this.getProviders()
    providers.push(provider)
    this.setProviders(providers)

    logger.info('provider', 'Provider added', {
      id: provider.id,
      name: provider.name,
      authType: provider.authType
    })

    return provider
  }

  public async update(id: string, config: Partial<Provider>): Promise<Provider> {
    const providers = this.getProviders()
    const index = providers.findIndex((entry) => entry.id === id)
    if (index === -1) {
      throw new Error('Provider not found')
    }

    const { keychainKey: _ignoredKeychainKey, id: _ignoredId, createdAt: _ignoredCreatedAt, ...allowed } =
      config

    const updatedProvider: Provider = {
      ...providers[index],
      ...allowed,
      baseUrl: allowed.baseUrl ? normalizeBaseUrl(allowed.baseUrl) : providers[index].baseUrl
    }

    providers[index] = updatedProvider
    this.setProviders(providers)

    return updatedProvider
  }

  public async remove(id: string): Promise<void> {
    const provider = this.findProvider(id)

    const remaining = this.getProviders().filter((entry) => entry.id !== id)
    this.setProviders(remaining)
    await keytar.deletePassword(KEYCHAIN_SERVICE_NAME, id)

    logger.info('provider', 'Provider removed', { id: provider.id, name: provider.name })
  }

  public async setApiKey(id: string, key: string): Promise<void> {
    if (!key.trim()) {
      throw new Error('API key is required')
    }

    this.findProvider(id)

    await keytar.setPassword(KEYCHAIN_SERVICE_NAME, id, key)
    this.updateProviderRuntime(id, { keychainKey: id })
  }

  public async getApiKeyHint(id: string): Promise<string> {
    this.findProvider(id)
    const key = await keytar.getPassword(KEYCHAIN_SERVICE_NAME, id)
    if (!key) {
      return '(not set)'
    }

    const last4 = key.slice(-4)
    return `sk-...${last4}`
  }

  public async testConnection(id: string): Promise<ConnectionResult> {
    const provider = this.findProvider(id)
    const startedAt = Date.now()

    try {
      const { response } = await this.requestModels(provider)
      const latencyMs = Date.now() - startedAt

      if (!response.ok) {
        const error = mapHttpErrorMessage(response.status)
        const status = response.status === 401 ? 'degraded' : 'offline'
        this.updateProviderRuntime(id, {
          status,
          lastLatencyMs: latencyMs,
          lastChecked: new Date().toISOString()
        })

        return {
          ok: false,
          latencyMs,
          error
        }
      }

      this.updateProviderRuntime(id, {
        status: 'online',
        lastLatencyMs: latencyMs,
        lastChecked: new Date().toISOString()
      })

      return { ok: true, latencyMs }
    } catch (error) {
      const latencyMs = Date.now() - startedAt
      const mappedError = mapNetworkError(error)

      this.updateProviderRuntime(id, {
        status: 'offline',
        lastLatencyMs: latencyMs,
        lastChecked: new Date().toISOString()
      })

      return {
        ok: false,
        latencyMs,
        error: mappedError
      }
    }
  }

  public async fetchModels(id: string): Promise<string[]> {
    const provider = this.findProvider(id)

    try {
      const { response, payload } = await this.requestModels(provider)
      if (!response.ok) {
        logger.warn('provider', 'Model list request failed', {
          id,
          status: response.status
        })
        return []
      }

      const dataArray = (payload.data as Array<{ id?: string }> | undefined) || []
      if (Array.isArray(dataArray) && dataArray.length > 0) {
        return dataArray
          .map((entry) => entry.id)
          .filter((entry): entry is string => typeof entry === 'string')
      }

      const ollamaModels = (payload.models as Array<{ name?: string }> | undefined) || []
      return ollamaModels
        .map((entry) => entry.name)
        .filter((entry): entry is string => typeof entry === 'string')
    } catch (error) {
      logger.warn('provider', 'Model list request failed', {
        id,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      return []
    }
  }
}

export const providerService = new ProviderService()
