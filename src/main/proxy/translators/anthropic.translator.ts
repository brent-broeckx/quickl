import type { Response as FetchResponse } from 'node-fetch'
import type { TranslatedRequest, TranslatedResponse } from '@shared/types'

type AnthropicRequestOptions = {
  baseUrl: string
}

type OpenAIMessage = {
  role?: string
  content?: unknown
}

type OpenAIRequestBody = {
  model?: string
  messages?: OpenAIMessage[]
  max_tokens?: number
  stream?: boolean
  [key: string]: unknown
}

type AnthropicResponseBody = {
  id?: string
  role?: string
  content?: Array<{ type?: string; text?: string }>
  stop_reason?: string
  usage?: {
    input_tokens?: number
    output_tokens?: number
  }
}

function mapStopReason(stopReason: string | undefined): string | null {
  if (!stopReason) {
    return null
  }

  if (stopReason === 'end_turn') {
    return 'stop'
  }

  return stopReason
}

export function translateRequest(
  body: unknown,
  apiKey: string,
  options?: AnthropicRequestOptions
): TranslatedRequest {
  if (!options) {
    throw new Error('Anthropic translator requires request options')
  }

  const payload = (body ?? {}) as OpenAIRequestBody
  const sourceMessages = Array.isArray(payload.messages) ? payload.messages : []

  const systemMessage = sourceMessages.find((message) => message.role === 'system')
  const messages = sourceMessages.filter((message) => message.role !== 'system')

  const anthropicBody: Record<string, unknown> = {
    ...payload,
    messages,
    max_tokens: typeof payload.max_tokens === 'number' ? payload.max_tokens : 4096
  }

  if (typeof systemMessage?.content === 'string') {
    anthropicBody.system = systemMessage.content
  }

  const normalizedBase = options.baseUrl.replace(/\/+$/, '')

  return {
    url: `${normalizedBase}/v1/messages`,
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(anthropicBody)
  }
}

export async function translateResponse(response: FetchResponse): Promise<TranslatedResponse> {
  const responseBody = (await response.json()) as AnthropicResponseBody
  const contentText = responseBody.content?.[0]?.text ?? ''
  const role = responseBody.role ?? 'assistant'

  const openAIBody = {
    id: responseBody.id,
    object: 'chat.completion',
    choices: [
      {
        message: {
          role,
          content: contentText
        },
        finish_reason: mapStopReason(responseBody.stop_reason)
      }
    ],
    usage: {
      prompt_tokens: responseBody.usage?.input_tokens ?? 0,
      completion_tokens: responseBody.usage?.output_tokens ?? 0
    }
  }

  return {
    status: response.status,
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify(openAIBody)
  }
}
