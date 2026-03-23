import type { Response as FetchResponse } from 'node-fetch'
import type { TranslatedRequest, TranslatedResponse } from '@shared/types'

type PassthroughRequestOptions = {
  baseUrl: string
  path: string
  authType: 'api-key' | 'none' | 'bearer'
  method?: string
}

export function translateRequest(
  body: unknown,
  apiKey: string,
  options?: PassthroughRequestOptions
): TranslatedRequest {
  if (!options) {
    throw new Error('Passthrough translator requires request options')
  }

  const normalizedBase = options.baseUrl.replace(/\/+$/, '')
  const normalizedPath = options.path.startsWith('/') ? options.path : `/${options.path}`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }

  if (options.authType !== 'none' && apiKey) {
    headers.Authorization = `Bearer ${apiKey}`
  }

  return {
    url: `${normalizedBase}${normalizedPath}`,
    method: options.method ?? 'POST',
    headers,
    body: JSON.stringify(body ?? {})
  }
}

export async function translateResponse(response: FetchResponse): Promise<TranslatedResponse> {
  const headers: Record<string, string> = {}
  response.headers.forEach((value, key) => {
    headers[key] = value
  })

  return {
    status: response.status,
    headers,
    body: await response.text()
  }
}
