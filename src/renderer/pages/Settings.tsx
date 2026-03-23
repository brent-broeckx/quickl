import React from 'react'
import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useProxyStore } from '@renderer/stores/use-proxy.store'

export function Settings(): React.ReactElement {
  const location = useLocation()
  const { status, ports, loading, error, saveMessage, fetchPorts, fetchStatus, setPorts, restart, clearSaveMessage } = useProxyStore()
  const [providerPort, setProviderPort] = useState<number>(ports.providerPort)
  const [mcpPort, setMcpPort] = useState<number>(ports.mcpPort)

  const showProxySection = new URLSearchParams(location.search).get('section') !== 'general'

  useEffect(() => {
    const load = async (): Promise<void> => {
      await fetchPorts()
      await fetchStatus()
      const latest = useProxyStore.getState().ports
      setProviderPort(latest.providerPort)
      setMcpPort(latest.mcpPort)
    }

    void load()
  }, [fetchPorts, fetchStatus])

  const handleSave = async (): Promise<void> => {
    await setPorts({ providerPort, mcpPort })
  }

  const handleRestartProvider = async (): Promise<void> => {
    await restart()
    await fetchStatus()
  }

  const handleRestartAggregator = async (): Promise<void> => {
    await restart()
    await fetchStatus()
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-8">Settings</h1>

        {showProxySection ? (
          <section className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-6">
            <div>
              <h2 className="text-xl font-semibold">Proxy</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Changing the port requires a proxy restart and updating any IDE configurations that point to the old port.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-border p-4 space-y-3">
                <h3 className="font-medium">Provider Proxy</h3>
                <label className="text-sm text-muted-foreground" htmlFor="provider-port">Port</label>
                <input
                  id="provider-port"
                  className="w-full rounded-md border border-border bg-background px-3 py-2"
                  min={1}
                  max={65535}
                  type="number"
                  value={providerPort}
                  onChange={(event) => setProviderPort(Number(event.target.value))}
                />
                <p className="text-sm">
                  Status:{' '}
                  <span className={status?.providerProxy.running ? 'text-emerald-600' : 'text-rose-600'}>
                    {status?.providerProxy.running ? 'running' : 'offline'}
                  </span>
                </p>
                <button
                  className="rounded-md bg-zinc-900 px-3 py-2 text-sm text-white hover:bg-zinc-700 disabled:opacity-60"
                  disabled={loading}
                  onClick={() => {
                    void handleRestartProvider()
                  }}
                  type="button"
                >
                  Restart Proxy
                </button>
              </div>

              <div className="rounded-lg border border-border p-4 space-y-3">
                <h3 className="font-medium">MCP Aggregator</h3>
                <label className="text-sm text-muted-foreground" htmlFor="mcp-port">Port</label>
                <input
                  id="mcp-port"
                  className="w-full rounded-md border border-border bg-background px-3 py-2"
                  min={1}
                  max={65535}
                  type="number"
                  value={mcpPort}
                  onChange={(event) => setMcpPort(Number(event.target.value))}
                />
                <p className="text-sm">
                  Status:{' '}
                  <span className={status?.mcpAggregator.running ? 'text-emerald-600' : 'text-rose-600'}>
                    {status?.mcpAggregator.running ? 'running' : 'offline'}
                  </span>{' '}
                  <span className="text-muted-foreground">· {status?.mcpAggregator.connectedClients ?? 0} clients</span>
                </p>
                <button
                  className="rounded-md bg-zinc-900 px-3 py-2 text-sm text-white hover:bg-zinc-700 disabled:opacity-60"
                  disabled={loading}
                  onClick={() => {
                    void handleRestartAggregator()
                  }}
                  type="button"
                >
                  Restart Aggregator
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-60"
                disabled={loading}
                onClick={() => {
                  void handleSave()
                }}
                type="button"
              >
                Save
              </button>
              {saveMessage ? (
                <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
                  <span>{saveMessage}</span>
                  <button
                    className="text-xs underline"
                    onClick={clearSaveMessage}
                    type="button"
                  >
                    Dismiss
                  </button>
                </div>
              ) : null}
            </div>

            {error ? (
              <div className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
                {error}
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </div>
  )
}
