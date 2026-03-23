import type { Response as FetchResponse } from 'node-fetch'
import type { TranslatedRequest, TranslatedResponse } from '@shared/types'

type GoogleRequestOptions = {
  baseUrl: string
}

type OpenAIMessage = {
  role?: string
  content?: string
}

type OpenAIRequestBody = {
  model?: string
  messages?: OpenAIMessage[]
}

type GoogleResponseBody = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>
    }
  }>
}

function mapRole(role: string | undefined): 'user' | 'model' {
  if (role === 'assistant') {
    return 'model'
  }

  return 'user'
}

export function translateRequest(
  body: unknown,
  apiKey: string,
  options?: GoogleRequestOptions
): TranslatedRequest {
  if (!options) {
    throw new Error('Google translator requires request options')
  }

  const payload = (body ?? {}) as OpenAIRequestBody
  const model = payload.model ?? 'gemini-2.0-flash'
  const messages = Array.isArray(payload.messages) ? payload.messages : []

  const contents = messages.map((message) => ({
    role: mapRole(message.role),
    parts: [{ text: String(message.content ?? '') }]
  }))

  const normalizedBase = options.baseUrl.replace(/\/+$/, '')
  return {
    url: `${normalizedBase}/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ contents })
  }
}

export async function translateResponse(response: FetchResponse): Promise<TranslatedResponse> {
  const responseBody = (await response.json()) as GoogleResponseBody
  const content = responseBody.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

  const openAIBody = {
    id: `google-${Date.now()}`,
    object: 'chat.completion',
    choices: [
      {
        message: {
          role: 'assistant',
          content
        },
        finish_reason: 'stop'
      }
    ]
  }

  return {
    status: response.status,
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify(openAIBody)
  }
}
