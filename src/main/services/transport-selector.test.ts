import { describe, expect, it } from 'vitest'
import { selectIDETransport } from '@main/services/transport-selector'

describe('selectIDETransport', () => {
  it('prefers streamable http for primary IDE targets', () => {
    expect(selectIDETransport('vscode', null)).toBe('http')
    expect(selectIDETransport('cursor', '0.45.2')).toBe('http')
    expect(selectIDETransport('windsurf', '1.2.3')).toBe('http')
  })

  it('falls back to sse for detected-only IDE targets', () => {
    expect(selectIDETransport('zed', null)).toBe('sse')
    expect(selectIDETransport('jetbrains', '2025.1')).toBe('sse')
    expect(selectIDETransport('neovim', null)).toBe('sse')
  })

  it('uses version-sensitive fallback for unknown IDEs', () => {
    expect(selectIDETransport('unknown', '0.9.0')).toBe('sse')
    expect(selectIDETransport('unknown', '1.0.0')).toBe('http')
  })
})
