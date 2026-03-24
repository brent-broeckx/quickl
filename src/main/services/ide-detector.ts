import { access, readdir } from 'node:fs/promises'
import { constants } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { IDE, IDEType } from '@shared/types'

type DetectionSeed = {
  type: IDEType
  name: string
  installPath: string
  configFilePath: string
  supportStatus: 'supported' | 'detected-only'
  supportMessage: string | null
  detectedExtensions: string[]
}

const KNOWN_EXTENSIONS = [
  { id: 'continue.continue', label: 'continue' },
  { id: 'saoudrizwan.claude-dev', label: 'cline' },
  { id: 'github.copilot-chat', label: 'copilot' }
]

async function exists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK)
    return true
  } catch {
    return false
  }
}

async function listExtensionLabels(dirPath: string): Promise<string[]> {
  if (!(await exists(dirPath))) {
    return []
  }

  const entries = await readdir(dirPath, { withFileTypes: true })
  const found = new Set<string>()

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue
    }

    const name = entry.name.toLowerCase()
    for (const extension of KNOWN_EXTENSIONS) {
      if (name.startsWith(extension.id)) {
        found.add(extension.label)
      }
    }
  }

  return Array.from(found)
}

function dedupeById(ides: IDE[]): IDE[] {
  const map = new Map<string, IDE>()
  for (const ide of ides) {
    map.set(ide.id, ide)
  }
  return Array.from(map.values())
}

function toId(type: IDEType, configFilePath: string): string {
  return `${type}:${configFilePath.replace(/\\/g, '/')}`
}

function toIDE(seed: DetectionSeed): IDE {
  return {
    id: toId(seed.type, seed.configFilePath),
    type: seed.type,
    name: seed.name,
    installPath: seed.installPath,
    version: null,
    detectedExtensions: seed.detectedExtensions,
    configuredByQuickl: false,
    configFilePath: seed.configFilePath,
    currentProviderId: null,
    supportStatus: seed.supportStatus,
    supportMessage: seed.supportMessage
  }
}

export class IDEDetector {
  public async scan(): Promise<IDE[]> {
    const home = homedir()
    const appData = process.env.APPDATA || join(home, 'AppData', 'Roaming')
    const localAppData = process.env.LOCALAPPDATA || join(home, 'AppData', 'Local')

    const vscodeSettings = join(appData, 'Code', 'User', 'settings.json')
    const vscodeMcp = join(appData, 'Code', 'User', 'mcp.json')
    const continueConfig = join(home, '.continue', 'config.json')
    const vscodeExtensions = join(home, '.vscode', 'extensions')

    const cursorSettings = join(appData, 'Cursor', 'User', 'settings.json')
    const cursorExtensions = join(home, '.cursor', 'extensions')

    const windsurfSettings = join(appData, 'Windsurf', 'User', 'settings.json')
    const windsurfExtensions = join(home, '.windsurf', 'extensions')

    const zedSettings = join(appData, 'Zed', 'settings.json')
    const jetBrainsRoot = join(appData, 'JetBrains')
    const nvimConfig = join(localAppData, 'nvim', 'init.lua')

    const vscodeDetected =
      (await exists(vscodeSettings)) || (await exists(continueConfig)) || (await exists(vscodeExtensions))
    const cursorDetected = (await exists(cursorSettings)) || (await exists(cursorExtensions))
    const windsurfDetected = (await exists(windsurfSettings)) || (await exists(windsurfExtensions))

    const vscodeDetectedExtensions = await listExtensionLabels(vscodeExtensions)
    const cursorDetectedExtensions = await listExtensionLabels(cursorExtensions)
    const windsurfDetectedExtensions = await listExtensionLabels(windsurfExtensions)

    const ides: IDE[] = []

    if (vscodeDetected) {
      const configFilePath = vscodeDetectedExtensions.includes('continue')
        ? continueConfig
        : vscodeDetectedExtensions.includes('copilot')
          ? vscodeMcp
          : vscodeSettings

      ides.push(
        toIDE({
          type: 'vscode',
          name: 'VS Code',
          installPath: join(localAppData, 'Programs', 'Microsoft VS Code'),
          configFilePath,
          supportStatus: 'supported',
          supportMessage: null,
          detectedExtensions: vscodeDetectedExtensions
        })
      )
    }

    if (cursorDetected) {
      ides.push(
        toIDE({
          type: 'cursor',
          name: 'Cursor',
          installPath: join(localAppData, 'Programs', 'Cursor'),
          configFilePath: cursorSettings,
          supportStatus: 'supported',
          supportMessage: null,
          detectedExtensions: cursorDetectedExtensions
        })
      )
    }

    if (windsurfDetected) {
      ides.push(
        toIDE({
          type: 'windsurf',
          name: 'Windsurf',
          installPath: join(localAppData, 'Programs', 'Windsurf'),
          configFilePath: windsurfSettings,
          supportStatus: 'supported',
          supportMessage: null,
          detectedExtensions: windsurfDetectedExtensions
        })
      )
    }

    if (await exists(zedSettings)) {
      ides.push(
        toIDE({
          type: 'zed',
          name: 'Zed',
          installPath: join(localAppData, 'Programs', 'Zed'),
          configFilePath: zedSettings,
          supportStatus: 'detected-only',
          supportMessage: 'Config support coming in v1.2.0.',
          detectedExtensions: []
        })
      )
    }

    if (await exists(jetBrainsRoot)) {
      ides.push(
        toIDE({
          type: 'jetbrains',
          name: 'JetBrains',
          installPath: jetBrainsRoot,
          configFilePath: join(jetBrainsRoot, 'options', 'other.xml'),
          supportStatus: 'detected-only',
          supportMessage: 'Config support coming in v1.2.0.',
          detectedExtensions: []
        })
      )
    }

    if (await exists(nvimConfig)) {
      ides.push(
        toIDE({
          type: 'neovim',
          name: 'Neovim',
          installPath: join(localAppData, 'nvim'),
          configFilePath: nvimConfig,
          supportStatus: 'detected-only',
          supportMessage: 'Config support coming in v1.2.0.',
          detectedExtensions: []
        })
      )
    }

    return dedupeById(ides)
  }
}

export const ideDetector = new IDEDetector()
