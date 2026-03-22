import { registerProviderHandlers } from '@main/ipc/providers.handler'
import { registerModelHandlers } from '@main/ipc/models.handler'
import { registerIDEHandlers } from '@main/ipc/ides'
import { registerMCPHandlers } from '@main/ipc/mcp'
import { registerGuardrailHandlers } from '@main/ipc/guardrails'
import { registerProfileHandlers } from '@main/ipc/profiles'
import { registerLogHandlers } from '@main/ipc/logs'
import { registerProxyHandlers } from '@main/ipc/proxy'
import { registerSystemHandlers } from '@main/ipc/system'
import { registerSettingsHandlers } from '@main/ipc/settings'

/**
 * Registers all domain-specific IPC handlers.
 */
export function setupIPCHandlers(): void {
  registerProviderHandlers()
  registerModelHandlers()
  registerIDEHandlers()
  registerMCPHandlers()
  registerGuardrailHandlers()
  registerProfileHandlers()
  registerLogHandlers()
  registerProxyHandlers()
  registerSystemHandlers()
  registerSettingsHandlers()
}
