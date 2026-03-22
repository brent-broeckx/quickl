import { BrowserWindow } from 'electron'
import fetch, { AbortError } from 'node-fetch'
import type { Response as FetchResponse } from 'node-fetch'
import net from 'node:net'
import { logger } from '@main/lib/logger'
import { store } from '@main/lib/store'
import type { LocalModel, ModelPullProgress, OllamaRegistryModel } from '@shared/types'

const OLLAMA_BASE_URL = 'http://localhost:11434'
const LMSTUDIO_BASE_URL = 'http://localhost:1234'

type JsonRecord = Record<string, unknown>

type OllamaTagsResponse = {
  models?: Array<{
    name?: string
    size?: number
  }>
}

type OllamaPsResponse = {
  models?: Array<{
    name?: string
    size_vram?: number
  }>
}

function mapCommonError(error: unknown): Error {
  if (!(error instanceof Error)) {
    return new Error('Unexpected model operation error')
  }

  const code = (error as Error & { code?: string }).code
  if (code === 'ECONNREFUSED') {
    return new Error('Could not connect to Ollama')
  }

  if (/aborted|timeout/i.test(error.message)) {
    return new Error('Request timed out')
  }

  return error
}

function responseError(status: number): Error {
  if (status === 404) {
    return new Error('Model not found')
  }

  return new Error(`Request failed with status ${status}`)
}

async function fetchWithTimeout(url: string, init: Parameters<typeof fetch>[1] = {}, timeoutMs = 6000): Promise<FetchResponse> {
  const controller = new AbortController()
  const timeout = timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal
    })
  } catch (error) {
    if (error instanceof AbortError) {
      throw new Error('Request timed out')
    }

    throw error
  } finally {
    if (timeout) {
      clearTimeout(timeout)
    }
  }
}

function toMb(bytes: number | undefined): number {
  if (!bytes || bytes < 0) {
    return 0
  }

  return Math.round((bytes / (1024 * 1024)) * 100) / 100
}

function parseFamily(name: string): string {
  const segment = name.split(':')[0]?.split('-')[0] ?? name
  return segment.trim().toLowerCase().replace(/[0-9.]+$/g, '')
}

function parseParameterSize(name: string): string {
  const match = name.match(/(\d+(?:\.\d+)?)\s*b/i)
  if (!match?.[1]) {
    return ''
  }

  return `${match[1]}B`
}

function parseQuantization(name: string): string {
  const segments = name.split(':').map((entry) => entry.trim()).filter(Boolean)
  if (segments.length < 2) {
    return ''
  }

  return segments[segments.length - 1]
}

function parseLibraryModelNamesFromHtml(html: string, query: string): string[] {
  const matches = html.matchAll(/href=["']\/library\/([^"'/?#]+)["']/gi)
  const names = Array.from(new Set(Array.from(matches, (match) => match[1]?.trim()).filter(Boolean)))
  return names.filter((name) => (query ? name.toLowerCase().includes(query) : true))
}

function parseModelTagsFromHtml(html: string, modelName: string): string[] {
  const escapedModel = modelName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`${escapedModel}:[^"'\\s>]*q[^"'\\s>]*`, 'gi')
  const matches = Array.from(html.matchAll(regex), (match) => match[0])

  return Array.from(
    new Set(
      matches
        .map((tag) => tag.trim())
        .filter((tag) => !/(text|base|fp|q[45]_[01])/i.test(tag))
    )
  )
}

function deriveSizesFromTags(tags: string[]): string[] {
  const sizeRegex = /(\d+(?:\.\d+)?)b/i
  const sizes = tags
    .map((tag) => tag.match(sizeRegex)?.[0]?.toLowerCase() ?? null)
    .filter((size): size is string => Boolean(size))

  return Array.from(new Set(sizes))
}

async function isPortOpen(port: number, host = '127.0.0.1', timeoutMs = 500): Promise<boolean> {
  return await new Promise((resolve) => {
    const socket = new net.Socket()
    let settled = false

    const finalize = (value: boolean): void => {
      if (settled) {
        return
      }

      settled = true
      socket.destroy()
      resolve(value)
    }

    socket.setTimeout(timeoutMs)
    socket.once('connect', () => finalize(true))
    socket.once('timeout', () => finalize(false))
    socket.once('error', () => finalize(false))
    socket.connect(port, host)
  })
}

export class ModelService {
  private registryModelNamesCache: string[] | null = null
  private registrySearchCache = new Map<string, OllamaRegistryModel[]>()
  private registryTagsCache = new Map<string, string[]>()

  private getTagsForModel(modelId: string): string[] {
    const allTags = store.get('modelTags', {})
    return allTags[modelId] ?? []
  }

  private setTagsForModel(modelId: string, tags: string[]): string[] {
    const allTags = store.get('modelTags', {})
    const deduped = Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean)))
    allTags[modelId] = deduped
    store.set('modelTags', allTags)
    return deduped
  }

  public async getTags(modelId: string): Promise<string[]> {
    return this.getTagsForModel(modelId)
  }

  public async addTag(modelId: string, tag: string): Promise<string[]> {
    const existing = this.getTagsForModel(modelId)
    return this.setTagsForModel(modelId, [...existing, tag])
  }

  public async removeTag(modelId: string, tag: string): Promise<string[]> {
    const existing = this.getTagsForModel(modelId)
    return this.setTagsForModel(
      modelId,
      existing.filter((entry) => entry.toLowerCase() !== tag.trim().toLowerCase())
    )
  }

  public async getLoadedModels(): Promise<string[]> {
    try {
      const response = await fetchWithTimeout(`${OLLAMA_BASE_URL}/api/ps`, { method: 'GET' }, 1000)
      if (!response.ok) {
        return []
      }

      const payload = (await response.json()) as OllamaPsResponse
      const models = payload.models ?? []
      return models
        .map((model) => model.name)
        .filter((name): name is string => typeof name === 'string' && name.length > 0)
    } catch {
      return []
    }
  }

  public async listInstalled(): Promise<LocalModel[]> {
    logger.debug('model', 'listInstalled called')

    const installed: LocalModel[] = []

    let loaded = new Set<string>()
    try {
      loaded = new Set(await this.getLoadedModels())
    } catch {
      loaded = new Set()
    }

    try {
      const response = await fetchWithTimeout(`${OLLAMA_BASE_URL}/api/tags`, { method: 'GET' }, 5000)
      if (response.ok) {
        const payload = (await response.json()) as OllamaTagsResponse
        for (const model of payload.models ?? []) {
          const name = model.name ?? ''
          if (!name) {
            continue
          }

          const id = `ollama:${name}`
          installed.push({
            id,
            name,
            family: parseFamily(name),
            parameterSize: parseParameterSize(name),
            quantization: parseQuantization(name),
            sizeMb: toMb(model.size),
            runtime: 'ollama',
            status: loaded.has(name) ? 'loaded' : 'available',
            downloadProgress: null,
            vramUsageMb: null,
            tags: this.getTagsForModel(id)
          })
        }
      }
    } catch {
      // Best effort for runtime discovery.
    }

    try {
      const lmStudioUp = await isPortOpen(1234)
      if (lmStudioUp) {
        const response = await fetchWithTimeout(`${LMSTUDIO_BASE_URL}/v1/models`, { method: 'GET' }, 1500)
        if (response.ok) {
          const payload = (await response.json()) as { data?: Array<{ id?: string }> }
          for (const model of payload.data ?? []) {
            const name = model.id ?? ''
            if (!name) {
              continue
            }

            const id = `lmstudio:${name}`
            installed.push({
              id,
              name,
              family: parseFamily(name),
              parameterSize: parseParameterSize(name),
              quantization: parseQuantization(name),
              sizeMb: 0,
              runtime: 'lmstudio',
              status: 'available',
              downloadProgress: null,
              vramUsageMb: null,
              tags: this.getTagsForModel(id)
            })
          }
        }
      }
    } catch {
      // Best effort for runtime discovery.
    }

    return installed.sort((a, b) => a.sizeMb - b.sizeMb)
  }

  public async pull(name: string): Promise<void> {
    logger.info('model', 'Model pull started', { name })

    try {
      const response = await fetchWithTimeout(
        `${OLLAMA_BASE_URL}/api/pull`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json'
          },
          body: JSON.stringify({ name })
        },
        0
      )

      if (!response.ok) {
        throw responseError(response.status)
      }

      if (!response.body) {
        this.emitPullProgress({
          name,
          status: 'success',
          progress: 100,
          completed: null,
          total: null
        })
        logger.info('model', 'Model pull complete', { name })
        return
      }

      let buffer = ''
      for await (const chunk of response.body) {
        buffer += chunk.toString()
        const lines = buffer.split(/\r?\n/)
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) {
            continue
          }

          let parsed: JsonRecord
          try {
            parsed = JSON.parse(trimmed) as JsonRecord
          } catch {
            continue
          }

          const status = typeof parsed.status === 'string' ? parsed.status : 'processing'
          const completed = typeof parsed.completed === 'number' ? parsed.completed : null
          const total = typeof parsed.total === 'number' ? parsed.total : null
          const progress = completed !== null && total !== null && total > 0
            ? Math.max(0, Math.min(100, Math.round((completed / total) * 100)))
            : 0

          this.emitPullProgress({
            name,
            status,
            progress,
            completed,
            total
          })

          if (status === 'success') {
            this.emitPullProgress({
              name,
              status,
              progress: 100,
              completed,
              total
            })
            logger.info('model', 'Model pull complete', { name })
          }
        }
      }
    } catch (error) {
      throw mapCommonError(error)
    }
  }

  public async delete(runtime: string, name: string): Promise<void> {
    logger.info('model', 'Model delete requested', { runtime, name })

    if (runtime !== 'ollama') {
      logger.warn('model', 'Delete not supported for runtime', { runtime, name })
      return
    }

    try {
      const response = await fetchWithTimeout(`${OLLAMA_BASE_URL}/api/delete`, {
        method: 'DELETE',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({ name })
      })

      if (!response.ok) {
        throw responseError(response.status)
      }
    } catch (error) {
      throw mapCommonError(error)
    }
  }

  public async load(name: string): Promise<void> {
    logger.info('model', 'Load model requested', { name })

    try {
      const response = await fetchWithTimeout(`${OLLAMA_BASE_URL}/api/generate`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: name,
          keep_alive: -1,
          prompt: ''
        })
      })

      if (!response.ok) {
        throw responseError(response.status)
      }
    } catch (error) {
      throw mapCommonError(error)
    }
  }

  public async unload(name: string): Promise<void> {
    logger.info('model', 'Unload model requested', { name })

    try {
      const response = await fetchWithTimeout(`${OLLAMA_BASE_URL}/api/generate`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: name,
          keep_alive: 0,
          prompt: ''
        })
      })

      if (!response.ok) {
        throw responseError(response.status)
      }
    } catch (error) {
      throw mapCommonError(error)
    }
  }

  public async searchRegistry(query: string): Promise<OllamaRegistryModel[]> {
    logger.debug('model', 'Registry search requested', { query })

    const trimmed = query.trim().toLowerCase()
    const cachedByQuery = this.registrySearchCache.get(trimmed)
    if (cachedByQuery) {
      return cachedByQuery
    }

    try {
      if (!this.registryModelNamesCache) {
        const libraryResponse = await fetchWithTimeout(
          'https://ollama.com/library',
          {
            method: 'GET',
            headers: {
              accept: 'text/html'
            }
          },
          5000
        )

        if (!libraryResponse.ok) {
          throw responseError(libraryResponse.status)
        }

        const libraryHtml = await libraryResponse.text()
        this.registryModelNamesCache = parseLibraryModelNamesFromHtml(libraryHtml, '')
      }

      const modelNames = (this.registryModelNamesCache ?? [])
        .filter((name) => (trimmed ? name.toLowerCase().includes(trimmed) : true))

      const results = await Promise.all(
        modelNames.map(async (name) => {
          const cachedTags = this.registryTagsCache.get(name)
          if (cachedTags) {
            return {
              name,
              description: '',
              pulls: 0,
              tags: cachedTags,
              sizes: deriveSizesFromTags(cachedTags)
            }
          }

          try {
            const tagsResponse = await fetchWithTimeout(
              `https://ollama.com/library/${encodeURIComponent(name)}/tags`,
              {
                method: 'GET',
                headers: {
                  accept: 'text/html'
                }
              },
              5000
            )

            if (!tagsResponse.ok) {
              this.registryTagsCache.set(name, [])
              return {
                name,
                description: '',
                pulls: 0,
                tags: [],
                sizes: []
              }
            }

            const tagsHtml = await tagsResponse.text()
            const tags = parseModelTagsFromHtml(tagsHtml, name)
            this.registryTagsCache.set(name, tags)

            return {
              name,
              description: '',
              pulls: 0,
              tags,
              sizes: deriveSizesFromTags(tags)
            }
          } catch {
            this.registryTagsCache.set(name, [])
            return {
              name,
              description: '',
              pulls: 0,
              tags: [],
              sizes: []
            }
          }
        })
      )

      this.registrySearchCache.set(trimmed, results)

      return results
    } catch (error) {
      logger.warn('model', 'Registry search failed', {
        query: trimmed,
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      this.registrySearchCache.set(trimmed, [])
      return []
    }
  }

  private emitPullProgress(progress: ModelPullProgress): void {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send('quickl:model-pull-progress', progress)
    }
  }
}

export const modelService = new ModelService()
