import { describe, expect, it } from 'vitest'
import { translateRequest, translateResponse } from '@main/proxy/translators/google.translator'

describe('google translator', () => {
  it('puts API key in query param and not Authorization header', () => {
    const translated = translateRequest(
      {
        model: 'gemini-2.0-flash',
        messages: [{ role: 'user', content: 'hello' }]
      },
      'google-key',
      { baseUrl: 'https://generativelanguage.googleapis.com' }
    )

    expect(translated.url).toContain('key=google-key')
    expect(translated.headers.Authorization).toBeUndefined()
  })

  it('maps assistant role to model role in contents array', () => {
    const translated = translateRequest(
      {
        model: 'gemini-2.0-flash',
        messages: [
          { role: 'user', content: 'Q' },
          { role: 'assistant', content: 'A' }
        ]
      },
      'google-key',
      { baseUrl: 'https://generativelanguage.googleapis.com' }
    )

    const body = JSON.parse(translated.body) as {
      contents: Array<{ role: string; parts: Array<{ text: string }> }>
    }

    expect(body.contents[0].role).toBe('user')
    expect(body.contents[1].role).toBe('model')
  })

  it('maps candidate response text to OpenAI message content', async () => {
    const translated = await translateResponse({
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: 'generated text' }]
            }
          }
        ]
      })
    } as never)

    const body = JSON.parse(translated.body as string) as {
      choices: Array<{ message: { content: string } }>
    }

    expect(body.choices[0].message.content).toBe('generated text')
  })
})
