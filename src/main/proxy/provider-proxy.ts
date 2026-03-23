import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { app, BrowserWindow } from 'electron'
import fetch, { type Response as FetchResponse } from 'node-fetch'
import type { Provider, TranslatedRequest } from '@shared/types'
import { logger } from '@main/lib/logger'
import { store } from '@main/lib/store'
import { providerService } from '@main/services/provider.service'
import * as openaiTranslator from '@main/proxy/translators/openai.translator'
import * as anthropicTranslator from '@main/proxy/translators/anthropic.translator'
import * as googleTranslator from '@main/proxy/translators/google.translator'
import * as passthroughTranslator from '@main/proxy/translators/passthrough.translator'

type ProxyRequestEvent = {
  method: string
  path: string
  status: number
  latencyMs: number
}

type TranslatorModule = {
  translateRequest: (body: unknown, apiKey: string, options?: unknown) => TranslatedRequest
  translateResponse: (response: FetchResponse) => Promise<{ status: number; headers: Record<string, string>; body: string | NodeJS.ReadableStream }>
}

const SUPPORTED_ROUTES = new Set([
  'POST /v1/chat/completions',
  'POST /v1/completions',
  'GET /v1/models',
  'POST /v1/embeddings'
])

function normalizeProviderName(name: string): string {
  return name.trim().toLowerCase()
}

function isProviderUnreachable(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }

  const err = error as Error & { code?: string; cause?: { code?: string } }
  const code = err.code ?? err.cause?.code
  return code === 'ECONNREFUSED' || code === 'ETIMEDOUT' || code === 'ENOTFOUND' || code === 'EHOSTUNREACH'
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
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
        resolve(JSON.parse(raw))
      } catch {
        reject(new Error('Invalid JSON body'))
      }
    })

    req.on('error', reject)
  })
}

function writeJson(res: ServerResponse, status: number, payload: Record<string, unknown>): void {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(payload))
}

function sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
  const nextHeaders = { ...headers }
  delete nextHeaders['content-length']
  return nextHeaders
}

function detectStreamingRequest(body: unknown): boolean {
  if (!body || typeof body !== 'object') {
    return false
  }

  return Boolean((body as { stream?: unknown }).stream)
}

function resolveActiveProvider(providers: Provider[]): Provider | null {
  const profiles = store.get('profiles', [])
  const activeProfile = profiles.find((profile) => profile.isActive)

  if (activeProfile?.defaultProviderId) {
    const matched = providers.find(
      (provider) => provider.id === activeProfile.defaultProviderId && provider.enabled
    )
    if (matched) {
      return matched
    }
  }

  return providers.find((provider) => provider.enabled) ?? null
}

function resolveTranslator(provider: Provider): TranslatorModule {
  const providerName = normalizeProviderName(provider.name)

  if (providerName === 'openai') {
    return openaiTranslator as TranslatorModule
  }

  if (providerName === 'anthropic') {
    return anthropicTranslator as TranslatorModule
  }

  if (providerName === 'google' || providerName === 'google gemini') {
    return googleTranslator as TranslatorModule
  }

  return passthroughTranslator as TranslatorModule
}

function mapTranslatedRequest(
  provider: Provider,
  translator: TranslatorModule,
  path: string,
  method: string,
  body: unknown,
  apiKey: string
): TranslatedRequest {
  const providerName = normalizeProviderName(provider.name)

  if (providerName === 'openai') {
    return translator.translateRequest(body, apiKey, {
      baseUrl: provider.baseUrl,
      path
    })
  }

  if (providerName === 'anthropic') {
    return translator.translateRequest(body, apiKey, {
      baseUrl: provider.baseUrl
    })
  }

  if (providerName === 'google' || providerName === 'google gemini') {
    return translator.translateRequest(body, apiKey, {
      baseUrl: provider.baseUrl
    })
  }

  return translator.translateRequest(body, apiKey, {
    baseUrl: provider.baseUrl,
    path,
    authType: provider.authType,
    method
  })
}

export class ProviderProxy {
  private server: Server | null = null
  private running = false
  private port = 3820
  private requestCount = 0
  private inFlightRequests = 0

  private emitRequest(event: ProxyRequestEvent): void {
    if (app.isPackaged) {
      return
    }

    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send('quickl:proxy-request', event)
    }
  }

  public getRequestCount(): number {
    return this.requestCount
  }

  public isRunning(): boolean {
    return this.running
  }

  public getPort(): number {
    return this.port
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

    logger.info('proxy', 'Provider proxy started', { port: this.port })
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
    logger.info('proxy', 'Provider proxy stopped')
  }

  public async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const startedAt = Date.now()
    this.inFlightRequests += 1

    try {
      const method = req.method ?? 'GET'
      const path = (req.url ?? '').split('?')[0]

      if (!SUPPORTED_ROUTES.has(`${method} ${path}`)) {
        writeJson(res, 404, { error: 'Not found' })
        this.requestCount += 1
        this.emitRequest({ method, path, status: 404, latencyMs: Date.now() - startedAt })
        return
      }

      const providers = await providerService.list()
      const activeProvider = resolveActiveProvider(providers)
      if (!activeProvider) {
        writeJson(res, 503, { error: 'No active provider configured in Quickl' })
        this.requestCount += 1
        this.emitRequest({ method, path, status: 503, latencyMs: Date.now() - startedAt })
        return
      }

      const apiKey = await providerService.getRawKey(activeProvider.id)
      if (activeProvider.authType !== 'none' && !apiKey) {
        writeJson(res, 401, { error: 'No API key configured for this provider in Quickl' })
        this.requestCount += 1
        this.emitRequest({ method, path, status: 401, latencyMs: Date.now() - startedAt })
        return
      }

      const body = method === 'GET' ? {} : await readJsonBody(req)
      const streamRequest = detectStreamingRequest(body)
      const translator = resolveTranslator(activeProvider)
      const translatedRequest = mapTranslatedRequest(
        activeProvider,
        translator,
        path,
        method,
        body,
        apiKey ?? ''
      )

      const abortController = new AbortController()
      const timeout = setTimeout(() => abortController.abort(), 120_000)

      let providerResponse: FetchResponse
      try {
        providerResponse = await fetch(translatedRequest.url, {
          method: translatedRequest.method,
          headers: translatedRequest.headers,
          body: translatedRequest.method === 'GET' ? undefined : translatedRequest.body,
          signal: abortController.signal
        })
      } finally {
        clearTimeout(timeout)
      }

      if (providerResponse.status === 401) {
        writeJson(res, 401, { error: 'Provider rejected the API key. Check your key in Quickl.' })
        this.requestCount += 1
        this.emitRequest({ method, path, status: 401, latencyMs: Date.now() - startedAt })
        return
      }

      if (providerResponse.status === 429) {
        writeJson(res, 429, { error: 'Rate limit reached for this provider.' })
        this.requestCount += 1
        this.emitRequest({ method, path, status: 429, latencyMs: Date.now() - startedAt })
        return
      }

      if (providerResponse.status >= 500) {
        writeJson(res, 502, { error: 'Provider returned an error. Try again.' })
        this.requestCount += 1
        this.emitRequest({ method, path, status: 502, latencyMs: Date.now() - startedAt })
        return
      }

      if (streamRequest && providerResponse.body) {
        const headers: Record<string, string> = {}
        providerResponse.headers.forEach((value, key) => {
          headers[key] = value
        })

        res.writeHead(providerResponse.status, {
          ...sanitizeHeaders(headers),
          'Content-Type': 'text/event-stream'
        })

        providerResponse.body.pipe(res)
        providerResponse.body.on('end', () => {
          this.requestCount += 1
          this.emitRequest({ method, path, status: providerResponse.status, latencyMs: Date.now() - startedAt })
        })
        return
      }

      const translatedResponse = await translator.translateResponse(providerResponse)
      res.writeHead(translatedResponse.status, sanitizeHeaders(translatedResponse.headers))

      if (typeof translatedResponse.body === 'string') {
        res.end(translatedResponse.body)
      } else {
        translatedResponse.body.pipe(res)
      }

      this.requestCount += 1
      this.emitRequest({ method, path, status: translatedResponse.status, latencyMs: Date.now() - startedAt })
      logger.debug('proxy', 'Provider proxy request handled', {
        method,
        path,
        providerName: activeProvider.name,
        status: translatedResponse.status,
        latencyMs: Date.now() - startedAt
      })
    } catch (error) {
      if (!res.headersSent) {
        if (isProviderUnreachable(error)) {
          writeJson(res, 502, { error: 'Could not reach provider. Is it running?' })
        } else if (error instanceof Error && error.message === 'Invalid JSON body') {
          writeJson(res, 400, { error: 'Invalid JSON body' })
        } else {
          writeJson(res, 500, { error: 'Quickl proxy encountered an unexpected error.' })
        }
      }

      logger.error('proxy', 'Provider proxy request failed', {
        error: error instanceof Error ? error.message : String(error)
      })
    } finally {
      this.inFlightRequests = Math.max(0, this.inFlightRequests - 1)
    }
  }
}

export const providerProxy = new ProviderProxy()
