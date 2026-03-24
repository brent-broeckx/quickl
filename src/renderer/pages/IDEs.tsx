import React, { useEffect, useMemo, useState } from 'react'
import type { IDE, Provider } from '@shared/types'
import { EmptyState } from '@renderer/components/EmptyState'
import { DiffViewer } from '@renderer/components/DiffViewer'
import { useIDEsStore } from '@renderer/stores/use-ides.store'
import { useProvidersStore } from '@renderer/stores/use-providers.store'

function supportBadge(ide: IDE): { text: string; className: string } {
  if (ide.supportStatus === 'supported') {
    return {
      text: 'Configurable',
      className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
    }
  }

  return {
    text: 'Detected only',
    className: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
  }
}

export function IDEs(): React.ReactElement {
  const {
    ides,
    pendingDiff,
    backupsByIde,
    loading,
    scanning,
    error,
    fetchIDEs,
    scanIDEs,
    previewConfig,
    applyConfig,
    resetConfig,
    fetchBackups,
    restoreBackup,
    clearPendingDiff
  } = useIDEsStore()

  const providers = useProvidersStore((state) => state.providers)
  const fetchProviders = useProvidersStore((state) => state.fetchProviders)
  const [selectedProviderId, setSelectedProviderId] = useState<string>('')
  const [activeIDE, setActiveIDE] = useState<IDE | null>(null)

  useEffect(() => {
    void fetchIDEs()
    void fetchProviders()
  }, [fetchIDEs, fetchProviders])

  const effectiveProviderId = useMemo(() => {
    if (selectedProviderId) {
      return selectedProviderId
    }

    const firstEnabled = providers.find((provider) => provider.enabled) || providers[0]
    return firstEnabled?.id || ''
  }, [providers, selectedProviderId])

  const providerMap = useMemo(() => {
    return new Map(providers.map((provider) => [provider.id, provider]))
  }, [providers])

  const openConfigPreview = async (ide: IDE): Promise<void> => {
    if (!effectiveProviderId) {
      return
    }

    await previewConfig(ide.id, effectiveProviderId)
    setActiveIDE(ide)
  }

  const onApply = async (): Promise<void> => {
    if (!activeIDE) {
      return
    }

    await applyConfig(activeIDE.id)
    await fetchBackups(activeIDE.id)
    setActiveIDE((current) =>
      current
        ? {
            ...current,
            configuredByQuickl: true,
            currentProviderId: effectiveProviderId || current.currentProviderId
          }
        : current
    )
  }

  const onReset = async (ideId: string): Promise<void> => {
    await resetConfig(ideId)
    await fetchBackups(ideId)
  }

  const onRestore = async (ideId: string, backupPath: string): Promise<void> => {
    await restoreBackup(ideId, backupPath)
    await fetchBackups(ideId)
  }

  const configuredCount = ides.filter((ide) => ide.configuredByQuickl).length

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">IDEs</h1>
            <p className="text-sm text-muted-foreground">
              Detected: {ides.length} | Configured by Quickl: {configuredCount}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              className="rounded-md border border-border bg-background px-2 py-2 text-sm"
              onChange={(event) => setSelectedProviderId(event.target.value)}
              value={effectiveProviderId}
            >
              {providers.map((provider: Provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name}
                </option>
              ))}
            </select>
            <button
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              disabled={scanning}
              onClick={() => void scanIDEs()}
              type="button"
            >
              {scanning ? 'Scanning...' : 'Scan for IDEs'}
            </button>
          </div>
        </div>

        {error ? (
          <div className="mb-4 rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
            {error}
          </div>
        ) : null}

        {ides.length === 0 ? (
          <EmptyState
            title="No IDEs Detected"
            description="Quickl will auto-configure your IDEs to use the local proxy gateway once you scan for them."
            actionLabel="Scan for IDEs"
            onAction={() => void scanIDEs()}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {ides.map((ide) => {
              const badge = supportBadge(ide)
              const backups = backupsByIde[ide.id] || []

              return (
                <article key={ide.id} className="rounded-xl border border-border bg-card p-5 shadow-sm">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold">{ide.name}</h2>
                      <p className="text-xs text-muted-foreground">{ide.configFilePath}</p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${badge.className}`}>
                      {badge.text}
                    </span>
                  </div>

                  <div className="mb-3 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-zinc-100 px-2 py-1 dark:bg-zinc-800">
                      Version: {ide.version || 'unknown'}
                    </span>
                    <span className="rounded-full bg-zinc-100 px-2 py-1 dark:bg-zinc-800">
                      {ide.configuredByQuickl ? 'Configured by Quickl' : 'Not configured'}
                    </span>
                    {ide.currentProviderId ? (
                      <span className="rounded-full bg-blue-100 px-2 py-1 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                        Provider: {providerMap.get(ide.currentProviderId)?.name || ide.currentProviderId}
                      </span>
                    ) : null}
                  </div>

                  <div className="mb-3 flex flex-wrap gap-2">
                    {ide.detectedExtensions.map((extension) => (
                      <span
                        key={extension}
                        className="rounded-full bg-zinc-200 px-2 py-1 text-[11px] uppercase dark:bg-zinc-800"
                      >
                        {extension}
                      </span>
                    ))}
                    {ide.detectedExtensions.length === 0 ? (
                      <span className="text-xs text-muted-foreground">No known AI extension detected</span>
                    ) : null}
                  </div>

                  {ide.supportMessage ? (
                    <p className="mb-3 text-xs text-muted-foreground">{ide.supportMessage}</p>
                  ) : null}

                  <div className="mb-3 flex flex-wrap gap-2">
                    <button
                      className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent disabled:opacity-60"
                      disabled={loading || ide.supportStatus !== 'supported' || !effectiveProviderId}
                      onClick={() => void openConfigPreview(ide)}
                      type="button"
                    >
                      Preview Diff
                    </button>
                    <button
                      className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent disabled:opacity-60"
                      disabled={loading || backups.length === 0}
                      onClick={() => void onReset(ide.id)}
                      type="button"
                    >
                      Restore Latest
                    </button>
                    <button
                      className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
                      onClick={() => void fetchBackups(ide.id)}
                      type="button"
                    >
                      Refresh Backups
                    </button>
                  </div>

                  {backups.length > 0 ? (
                    <div className="rounded-md bg-zinc-50 p-2 dark:bg-zinc-900">
                      <p className="mb-2 text-xs font-medium">Backup history</p>
                      <ul className="space-y-2">
                        {backups.slice(0, 3).map((backup) => (
                          <li key={backup.backupPath} className="flex items-center justify-between gap-3 text-xs">
                            <span className="truncate text-muted-foreground">{new Date(backup.createdAt).toLocaleString()}</span>
                            <button
                              className="rounded border border-border px-2 py-1 hover:bg-accent"
                              onClick={() => void onRestore(ide.id, backup.backupPath)}
                              type="button"
                            >
                              Restore
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </article>
              )
            })}
          </div>
        )}

        {activeIDE && pendingDiff && pendingDiff.ideId === activeIDE.id ? (
          <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 p-4">
            <div className="max-h-[90vh] w-full max-w-6xl overflow-auto rounded-xl bg-background p-6 shadow-xl">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-semibold">Config Preview: {activeIDE.name}</h3>
                  <p className="text-xs text-muted-foreground">{pendingDiff.filePath}</p>
                </div>
                <button
                  className="rounded border border-border px-2 py-1 text-xs"
                  onClick={() => {
                    clearPendingDiff()
                    setActiveIDE(null)
                  }}
                  type="button"
                >
                  Close
                </button>
              </div>

              <DiffViewer after={pendingDiff.after} before={pendingDiff.before} />

              <div className="mt-4 flex justify-end gap-2">
                <button
                  className="rounded border border-border px-3 py-2 text-sm"
                  onClick={() => {
                    clearPendingDiff()
                    setActiveIDE(null)
                  }}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  onClick={() => void onApply()}
                  type="button"
                >
                  Apply Configuration
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
