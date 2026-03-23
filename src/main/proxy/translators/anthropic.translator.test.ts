import { describe, expect, it } from 'vitest'
import { translateRequest, translateResponse } from '@main/proxy/translators/anthropic.translator'

describe('anthropic translator', () => {
  it('extracts system message and removes it from messages array', () => {
    const translated = translateRequest(
      {
        model: 'claude-3-5-sonnet',
        messages: [
          { role: 'system', content: 'System rule' },
          { role: 'user', content: 'Hello' }
        ]
      },
      'secret-key',
      { baseUrl: 'https://api.anthropic.com' }
    )

    const body = JSON.parse(translated.body) as {
      system?: string
      messages: Array<{ role: string; content: string }>
      max_tokens: number
    }

    expect(body.system).toBe('System rule')
    expect(body.messages).toEqual([{ role: 'user', content: 'Hello' }])
  })

  it('defaults max_tokens to 4096 when not provided', () => {
    const translated = translateRequest(
      {
        model: 'claude-3-5-sonnet',
        messages: [{ role: 'user', content: 'Hello' }]
      },
      'secret-key',
      { baseUrl: 'https://api.anthropic.com' }
    )

    const body = JSON.parse(translated.body) as { max_tokens: number }
    expect(body.max_tokens).toBe(4096)
  })

  it('sets required anthropic headers', () => {
    const translated = translateRequest(
      { model: 'claude', messages: [] },
      'secret-key',
      { baseUrl: 'https://api.anthropic.com' }
    )

    expect(translated.headers['x-api-key']).toBe('secret-key')
    expect(translated.headers['anthropic-version']).toBe('2023-06-01')
  })

  it('maps response fields to OpenAI format', async () => {
    const translated = await translateResponse({
      status: 200,
      json: async () => ({
        id: 'msg_123',
        role: 'assistant',
        content: [{ type: 'text', text: 'Hello back' }],
        stop_reason: 'end_turn',
        usage: {
          input_tokens: 12,
          output_tokens: 34
        }
      })
    } as never)

    const body = JSON.parse(translated.body as string) as {
      choices: Array<{
        message: { role: string; content: string }
        finish_reason: string
      }>
      usage: {
        prompt_tokens: number
        completion_tokens: number
      }
    }

    expect(body.choices[0].finish_reason).toBe('stop')
    expect(body.usage.prompt_tokens).toBe(12)
    expect(body.usage.completion_tokens).toBe(34)
    expect(body.choices[0].message.content).toBe('Hello back')
  })
})
