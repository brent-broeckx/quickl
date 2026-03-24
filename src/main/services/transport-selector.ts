import type { IDEType } from '@shared/types'

export type IDETransport = 'http' | 'sse'

function parseMajor(version: string | null): number | null {
  if (!version) {
    return null
  }

  const matched = version.match(/\d+/)
  if (!matched) {
    return null
  }

  const major = Number.parseInt(matched[0], 10)
  return Number.isNaN(major) ? null : major
}

export function selectIDETransport(type: IDEType, version: string | null): IDETransport {
  const major = parseMajor(version)

  if (type === 'vscode' || type === 'cursor' || type === 'windsurf') {
    return 'http'
  }

  if (type === 'unknown') {
    if (major !== null && major < 1) {
      return 'sse'
    }
    return 'http'
  }

  return 'sse'
}
