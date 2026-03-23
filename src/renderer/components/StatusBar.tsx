import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useProxyStore } from '@renderer/stores/use-proxy.store'

interface StatusBarProps {
  version: string
}

export function StatusBar({ version }: Readonly<StatusBarProps>): React.ReactElement {
  const navigate = useNavigate()
  const status = useProxyStore((state) => state.status)

  const providerRunning = Boolean(status?.providerProxy.running)
  const providerPort = status?.providerProxy.port ?? 3820

  const mcpRunning = Boolean(status?.mcpAggregator.running)
  const mcpPort = status?.mcpAggregator.port ?? 3821
  const mcpClients = status?.mcpAggregator.connectedClients ?? 0
  const mcpDotClass = !mcpRunning
    ? 'bg-rose-500'
    : mcpClients > 0
      ? 'bg-zinc-400'
      : 'bg-emerald-500'
  const mcpLabel = !mcpRunning
    ? 'MCP offline'
    : mcpClients > 0
      ? `MCP :${mcpPort} · ${mcpClients} clients`
      : `MCP :${mcpPort}`

  const openProxySettings = (): void => {
    navigate('/settings?section=proxy')
  }

  return (
    <div className="h-12 bg-muted border-t border-border flex items-center px-6 space-x-8 text-sm">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">Active Provider:</span>
        <span className="text-foreground font-medium">No provider</span>
      </div>

      <button className="flex items-center gap-2" onClick={openProxySettings} type="button">
        <span
          className={`h-2.5 w-2.5 rounded-full ${providerRunning ? 'bg-emerald-500' : 'bg-rose-500'}`}
        />
        <span className="text-foreground font-medium">
          {providerRunning ? `Proxy :${providerPort}` : 'Proxy offline'}
        </span>
      </button>

      <button className="flex items-center gap-2" onClick={openProxySettings} type="button">
        <span className={`h-2.5 w-2.5 rounded-full ${mcpDotClass}`} />
        <span className="text-foreground font-medium">{mcpLabel}</span>
      </button>

      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">Guardrails:</span>
        <span className="text-foreground font-medium">No profile</span>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <span className="text-muted-foreground">v{version}</span>
      </div>
    </div>
  )
}
