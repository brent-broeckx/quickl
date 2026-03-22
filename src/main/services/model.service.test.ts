import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ModelService } from '@main/services/model.service'

const mocks = vi.hoisted(() => {
  const sendMock = vi.fn()
  const portState = { lmStudioUp: false }

  class FakeSocket {
    private handlers: Record<string, ((...args: unknown[]) => void)[]> = {}

    setTimeout(): void {}

    once(event: string, handler: (...args: unknown[]) => void): this {
      this.handlers[event] = this.handlers[event] ?? []
      this.handlers[event].push(handler)
      return this
    }

    connect(): void {
      const event = portState.lmStudioUp ? 'connect' : 'error'
      const listeners = this.handlers[event] ?? []
      for (const listener of listeners) {
        listener()
      }
    }

    destroy(): void {}
  }

  return {
    fetchMock: vi.fn(),
    getMock: vi.fn(),
    setMock: vi.fn(),
    debugMock: vi.fn(),
    infoMock: vi.fn(),
    warnMock: vi.fn(),
    errorMock: vi.fn(),
    sendMock,
    getAllWindowsMock: vi.fn(() => [{ webContents: { send: sendMock } }]),
    socketCtor: FakeSocket,
    portState
  }
})

vi.mock('node-fetch', () => {
  return {
    default: mocks.fetchMock,
    AbortError: class AbortError extends Error {}
  }
})

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
      debug: mocks.debugMock,
      info: mocks.infoMock,
      warn: mocks.warnMock,
      error: mocks.errorMock
    }
  }
})

vi.mock('electron', () => {
  return {
    BrowserWindow: {
      getAllWindows: mocks.getAllWindowsMock
    }
  }
})

vi.mock('node:net', () => {
  return {
    default: {
      Socket: mocks.socketCtor
    }
  }
})

function mockJsonResponse(payload: unknown, status = 200): { ok: boolean; status: number; json: () => Promise<unknown> } {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload
  }
}

function mockStreamResponse(lines: string[]): { ok: boolean; status: number; body: AsyncIterable<Buffer> } {
  return {
    ok: true,
    status: 200,
    body: {
      async *[Symbol.asyncIterator](): AsyncGenerator<Buffer> {
        for (const line of lines) {
          yield Buffer.from(`${line}\n`)
        }
      }
    }
  }
}

describe('ModelService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getMock.mockImplementation((key: string, fallback?: unknown) => {
      if (key === 'modelTags') {
        return {}
      }

      if (key === 'modelRegistryCache') {
        return null
      }

      return fallback
    })
    mocks.portState.lmStudioUp = false
  })

  it('listInstalled returns merged array from Ollama and LM Studio', async () => {
    mocks.portState.lmStudioUp = true
    mocks.fetchMock
      .mockResolvedValueOnce(mockJsonResponse({ models: [{ name: 'llama3.2:3b', size_vram: 1024 }] }))
      .mockResolvedValueOnce(mockJsonResponse({ models: [{ name: 'llama3.2:3b', size: 3_221_225_472 }] }))
      .mockResolvedValueOnce(mockJsonResponse({ data: [{ id: 'qwen2.5-coder:7b' }] }))

    const service = new ModelService()
    const result = await service.listInstalled()

    expect(result).toHaveLength(2)
    expect(result.some((entry) => entry.runtime === 'ollama')).toBe(true)
    expect(result.some((entry) => entry.runtime === 'lmstudio')).toBe(true)
  })

  it('listInstalled returns only Ollama models when LM Studio is not running', async () => {
    mocks.fetchMock
      .mockResolvedValueOnce(mockJsonResponse({ models: [] }))
      .mockResolvedValueOnce(mockJsonResponse({ models: [{ name: 'mistral:7b', size: 7_516_192_768 }] }))

    const service = new ModelService()
    const result = await service.listInstalled()

    expect(result).toHaveLength(1)
    expect(result[0].runtime).toBe('ollama')
  })

  it('listInstalled returns empty array if neither runtime is available', async () => {
    mocks.fetchMock.mockRejectedValue(new Error('connect ECONNREFUSED'))

    const service = new ModelService()
    const result = await service.listInstalled()

    expect(result).toEqual([])
  })

  it('listInstalled parses family, parameterSize, and quantization', async () => {
    mocks.fetchMock
      .mockResolvedValueOnce(mockJsonResponse({ models: [] }))
      .mockResolvedValueOnce(
        mockJsonResponse({ models: [{ name: 'llama3.2:3b:q4_k_m', size: 3_221_225_472 }] })
      )

    const service = new ModelService()
    const [model] = await service.listInstalled()

    expect(model.family).toBe('llama')
    expect(model.parameterSize).toBe('3B')
    expect(model.quantization).toBe('q4_k_m')
  })

  it('pull emits progress events for each NDJSON line', async () => {
    mocks.fetchMock.mockResolvedValue(
      mockStreamResponse([
        JSON.stringify({ status: 'pulling', completed: 25, total: 100 }),
        JSON.stringify({ status: 'pulling', completed: 50, total: 100 })
      ])
    )

    const service = new ModelService()
    await service.pull('llama3.2:3b')

    expect(mocks.sendMock).toHaveBeenCalledWith(
      'quickl:model-pull-progress',
      expect.objectContaining({ name: 'llama3.2:3b', progress: 25 })
    )
    expect(mocks.sendMock).toHaveBeenCalledWith(
      'quickl:model-pull-progress',
      expect.objectContaining({ name: 'llama3.2:3b', progress: 50 })
    )
  })

  it('pull emits final progress 100 when status is success', async () => {
    mocks.fetchMock.mockResolvedValue(
      mockStreamResponse([JSON.stringify({ status: 'success', completed: 100, total: 100 })])
    )

    const service = new ModelService()
    await service.pull('llama3.2:3b')

    expect(mocks.sendMock).toHaveBeenCalledWith(
      'quickl:model-pull-progress',
      expect.objectContaining({ name: 'llama3.2:3b', progress: 100, status: 'success' })
    )
  })

  it('delete calls Ollama delete endpoint', async () => {
    mocks.fetchMock.mockResolvedValue(mockJsonResponse({ ok: true }))

    const service = new ModelService()
    await service.delete('ollama', 'llama3.2:3b')

    expect(mocks.fetchMock).toHaveBeenCalledWith(
      'http://localhost:11434/api/delete',
      expect.objectContaining({ method: 'DELETE' })
    )
  })

  it('load sends keep_alive -1 payload', async () => {
    mocks.fetchMock.mockResolvedValue(mockJsonResponse({ done: true }))

    const service = new ModelService()
    await service.load('llama3.2:3b')

    expect(mocks.fetchMock).toHaveBeenCalledWith(
      'http://localhost:11434/api/generate',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ model: 'llama3.2:3b', keep_alive: -1, prompt: '' })
      })
    )
  })

  it('unload sends keep_alive 0 payload', async () => {
    mocks.fetchMock.mockResolvedValue(mockJsonResponse({ done: true }))

    const service = new ModelService()
    await service.unload('llama3.2:3b')

    expect(mocks.fetchMock).toHaveBeenCalledWith(
      'http://localhost:11434/api/generate',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ model: 'llama3.2:3b', keep_alive: 0, prompt: '' })
      })
    )
  })
})
