import type { Response as FetchResponse } from 'node-fetch'
import type { TranslatedRequest, TranslatedResponse } from '@shared/types'

type OpenAIRequestOptions = {
  baseUrl: string
  path: string
}

export function translateRequest(
  body: unknown,
  apiKey: string,
  options?: OpenAIRequestOptions
): TranslatedRequest {
  if (!options) {
    throw new Error('OpenAI translator requires request options')
  }

  const normalizedBase = options.baseUrl.replace(/\/+$/, '')
  const normalizedPath = options.path.startsWith('/') ? options.path : `/${options.path}`

  return {
    url: `${normalizedBase}${normalizedPath}`,
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
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
