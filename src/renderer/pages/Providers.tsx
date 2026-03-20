import React, { useEffect, useMemo, useState } from 'react'
import type { AddProviderInput, Provider } from '@shared/types'
import { EmptyState } from '@renderer/components/EmptyState'
import { useProvidersStore } from '@renderer/stores/use-providers.store'
import { ProviderLogo } from '@renderer/assets/providers/ProviderLogos'

type ProviderPreset = {
  label: string
  name: string
  baseUrl: string
  authType: Provider['authType']
}

type TestResult = {
  ok: boolean
  latencyMs: number
  error?: string
}

const PRESETS: ProviderPreset[] = [
  { label: 'OpenAI', name: 'openai', baseUrl: 'https://api.openai.com', authType: 'api-key' },
  { label: 'Anthropic', name: 'anthropic', baseUrl: 'https://api.anthropic.com', authType: 'api-key' },
  {
    label: 'Google Gemini',
    name: 'google',
    baseUrl: 'https://generativelanguage.googleapis.com',
    authType: 'api-key'
  },
  { label: 'Mistral', name: 'mistral', baseUrl: 'https://api.mistral.ai', authType: 'api-key' },
  { label: 'Groq', name: 'groq', baseUrl: 'https://api.groq.com/openai', authType: 'api-key' },
  { label: 'Ollama', name: 'ollama', baseUrl: 'http://localhost:11434', authType: 'none' },
  { label: 'LM Studio', name: 'lmstudio', baseUrl: 'http://localhost:1234', authType: 'none' },
  { label: 'vLLM', name: 'vllm', baseUrl: 'http://localhost:8000', authType: 'bearer' },
  { label: 'Jan', name: 'jan', baseUrl: 'http://localhost:1337', authType: 'none' },
  { label: 'Custom', name: 'custom', baseUrl: 'http://localhost:8080', authType: 'bearer' }
]

function statusChip(status: Provider['status'], enabled: boolean): { label: string; dotClass: string } {
  if (!enabled) {
    return { label: 'Disabled', dotClass: 'bg-zinc-400' }
  }

  if (status === 'online') {
    return { label: 'Online', dotClass: 'bg-emerald-500' }
  }

  if (status === 'degraded') {
    return { label: 'Degraded', dotClass: 'bg-amber-400' }
  }

  if (status === 'offline') {
    return { label: 'Offline', dotClass: 'bg-rose-500' }
  }

  return { label: 'Unknown', dotClass: 'bg-slate-400' }
}

function latencyClass(latencyMs: number | null): string {
  if (latencyMs === null) {
    return 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200'
  }

  if (latencyMs < 200) {
    return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
  }

  if (latencyMs < 1000) {
    return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
  }

  return 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
}

function relativeTime(iso: string | null): string {
  if (!iso) {
    return 'Never'
  }

  const now = Date.now()
  const then = new Date(iso).getTime()
  const diff = Math.max(0, Math.floor((now - then) / 1000))

  if (diff < 60) {
    return `${diff}s ago`
  }

  if (diff < 3600) {
    return `${Math.floor(diff / 60)} min ago`
  }

  if (diff < 86400) {
    return `${Math.floor(diff / 3600)}h ago`
  }

  return `${Math.floor(diff / 86400)}d ago`
}

export function Providers(): React.ReactElement {
  const {
    providers,
    loading,
    error,
    fetchProviders,
    addProvider,
    updateProvider,
    removeProvider,
    testConnection,
    updateProviderStatus
  } = useProvidersStore()

  const [isAddOpen, setIsAddOpen] = useState(false)
  const [selectedPreset, setSelectedPreset] = useState<ProviderPreset | null>(null)
  const [configName, setConfigName] = useState('')
  const [configBaseUrl, setConfigBaseUrl] = useState('')
  const [configAuthType, setConfigAuthType] = useState<Provider['authType']>('api-key')
  const [configApiKey, setConfigApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null)
  const [editApiKeyHint, setEditApiKeyHint] = useState('(not set)')
  const [editApiKey, setEditApiKey] = useState('')
  const [removeTarget, setRemoveTarget] = useState<Provider | null>(null)
  const [expandedCardIds, setExpandedCardIds] = useState<Record<string, boolean>>({})
  const [modelsByProvider, setModelsByProvider] = useState<Record<string, string[]>>({})
  const [modelsLoadingByProvider, setModelsLoadingByProvider] = useState<Record<string, boolean>>({})

  useEffect(() => {
    void fetchProviders()
  }, [fetchProviders])

  useEffect(() => {
    const offStatusChanged = window.quickl.providers.onStatusChanged((payload) => {
      updateProviderStatus(payload.id, payload.status, payload.latencyMs)
    })

    return () => {
      offStatusChanged()
    }
  }, [updateProviderStatus])

  const canSaveAdd = useMemo(() => {
    if (!configName.trim() || !configBaseUrl.trim()) {
      return false
    }

    if (configAuthType === 'api-key' && !configApiKey.trim()) {
      return false
    }

    return true
  }, [configName, configBaseUrl, configAuthType, configApiKey])

  const onPresetSelect = (preset: ProviderPreset): void => {
    setSelectedPreset(preset)
    setConfigName(preset.name)
    setConfigBaseUrl(preset.baseUrl)
    setConfigAuthType(preset.authType)
    setConfigApiKey('')
    setTestResult(null)
    setAddError(null)
  }

  const onTestNewProvider = async (): Promise<void> => {
    setAddError(null)
    setTestResult(null)

    try {
      const tempProvider: AddProviderInput = {
        name: configName,
        baseUrl: configBaseUrl,
        authType: configAuthType,
        enabled: true,
        type: selectedPreset?.name === 'custom' ? 'local' : undefined
      }

      const created = await window.quickl.providers.add(tempProvider)
      if (configAuthType === 'api-key' || configAuthType === 'bearer') {
        if (configApiKey.trim()) {
          await window.quickl.providers.setApiKey(created.id, configApiKey)
        }
      }

      const result = await window.quickl.providers.testConnection(created.id)
      setTestResult(result)
      await window.quickl.providers.remove(created.id)
      await fetchProviders()
    } catch (testError) {
      setTestResult({
        ok: false,
        latencyMs: 0,
        error: testError instanceof Error ? testError.message : 'Could not test provider'
      })
    }
  }

  const onSaveProvider = async (): Promise<void> => {
    setAddError(null)

    try {
      await addProvider(
        {
          name: configName,
          baseUrl: configBaseUrl,
          authType: configAuthType,
          enabled: true,
          type: selectedPreset?.name === 'custom' ? 'local' : undefined
        },
        configApiKey
      )
      setIsAddOpen(false)
      setSelectedPreset(null)
      setConfigName('')
      setConfigBaseUrl('')
      setConfigApiKey('')
      setTestResult(null)
    } catch (saveError) {
      setAddError(saveError instanceof Error ? saveError.message : 'Failed to save provider')
    }
  }

  const onStartEdit = async (provider: Provider): Promise<void> => {
    setEditingProvider(provider)
    setEditApiKey('')
    try {
      const hint = await window.quickl.providers.getApiKeyHint(provider.id)
      setEditApiKeyHint(hint)
    } catch {
      setEditApiKeyHint('(not set)')
    }
  }

  const onSaveEdit = async (): Promise<void> => {
    if (!editingProvider) {
      return
    }

    await updateProvider(editingProvider.id, {
      name: editingProvider.name,
      baseUrl: editingProvider.baseUrl,
      authType: editingProvider.authType,
      enabled: editingProvider.enabled
    })

    if (editApiKey.trim()) {
      await window.quickl.providers.setApiKey(editingProvider.id, editApiKey)
    }

    setEditingProvider(null)
    setEditApiKey('')
    await fetchProviders()
  }

  const onRemoveProvider = async (): Promise<void> => {
    if (!removeTarget) {
      return
    }

    await removeProvider(removeTarget.id)
    setRemoveTarget(null)
  }

  const toggleExpanded = async (providerId: string): Promise<void> => {
    const nextExpanded = !expandedCardIds[providerId]
    setExpandedCardIds((current) => ({ ...current, [providerId]: nextExpanded }))

    if (nextExpanded && !modelsByProvider[providerId]) {
      setModelsLoadingByProvider((current) => ({ ...current, [providerId]: true }))
      const models = await window.quickl.providers.listModels(providerId)
      setModelsByProvider((current) => ({ ...current, [providerId]: models }))
      setModelsLoadingByProvider((current) => ({ ...current, [providerId]: false }))
    }
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-8">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-bold">Providers</h1>
          <button
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            onClick={() => setIsAddOpen(true)}
            type="button"
          >
            Add Provider
          </button>
        </div>

        {error ? (
          <div className="mb-4 rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
            {error}
          </div>
        ) : null}

        {!loading && providers.length === 0 ? (
          <EmptyState
            title="No Providers"
            description="Add cloud AI providers like OpenAI, Anthropic, or configure local endpoints."
            actionLabel="Add Provider"
            onAction={() => setIsAddOpen(true)}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {providers.map((provider) => {
              const status = statusChip(provider.status, provider.enabled)
              return (
                <article
                  key={provider.id}
                  className="rounded-xl border border-border bg-card p-4 shadow-sm"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <ProviderLogo name={provider.name} />
                      <div>
                        <h2 className="text-base font-semibold capitalize">{provider.name}</h2>
                        <p className="text-xs text-muted-foreground">{provider.baseUrl}</p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-2 rounded-full bg-zinc-100 px-2 py-1 text-xs dark:bg-zinc-800">
                      <span className={`h-2 w-2 rounded-full ${status.dotClass}`} />
                      {status.label}
                    </span>
                  </div>

                  <div className="mb-3 flex items-center justify-between text-xs">
                    <span
                      className={`rounded-full px-2 py-1 font-medium ${latencyClass(provider.lastLatencyMs)}`}
                    >
                      {provider.lastLatencyMs ?? '-'}ms
                    </span>
                    <span className="text-muted-foreground">{relativeTime(provider.lastChecked)}</span>
                  </div>

                  <div className="mb-3 flex flex-wrap gap-2">
                    <button
                      className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
                      onClick={() => void testConnection(provider.id)}
                      type="button"
                    >
                      Test
                    </button>
                    <button
                      className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
                      onClick={() => void onStartEdit(provider)}
                      type="button"
                    >
                      Edit
                    </button>
                    <button
                      className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
                      onClick={() => void updateProvider(provider.id, { enabled: !provider.enabled })}
                      type="button"
                    >
                      {provider.enabled ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      className="rounded-md border border-rose-300 px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300"
                      onClick={() => setRemoveTarget(provider)}
                      type="button"
                    >
                      Remove
                    </button>
                  </div>

                  <button
                    className="mb-2 inline-flex items-center text-xs font-medium text-blue-600"
                    onClick={() => void toggleExpanded(provider.id)}
                    type="button"
                  >
                    {expandedCardIds[provider.id] ? 'Hide models' : 'Show models'}
                  </button>

                  {expandedCardIds[provider.id] ? (
                    <div className="rounded-md bg-zinc-50 p-2 text-xs dark:bg-zinc-900">
                      {modelsLoadingByProvider[provider.id] ? (
                        <div className="space-y-2">
                          <div className="h-4 w-24 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
                          <div className="h-4 w-32 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
                        </div>
                      ) : null}

                      {!modelsLoadingByProvider[provider.id] && modelsByProvider[provider.id]?.length ? (
                        <div className="flex flex-wrap gap-1">
                          {modelsByProvider[provider.id].map((model) => (
                            <span
                              key={model}
                              className="rounded-full bg-zinc-200 px-2 py-1 text-[11px] dark:bg-zinc-800"
                            >
                              {model}
                            </span>
                          ))}
                        </div>
                      ) : null}

                      {!modelsLoadingByProvider[provider.id] && !modelsByProvider[provider.id]?.length ? (
                        <p className="text-muted-foreground">No models found</p>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              )
            })}
          </div>
        )}
      </div>

      {isAddOpen ? (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-3xl rounded-xl bg-background p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Add Provider</h2>
              <button
                className="rounded border border-border px-2 py-1 text-xs"
                onClick={() => setIsAddOpen(false)}
                type="button"
              >
                Close
              </button>
            </div>

            {selectedPreset ? (
              <div className="space-y-3">
                <button
                  className="rounded border border-border px-2 py-1 text-xs"
                  onClick={() => setSelectedPreset(null)}
                  type="button"
                >
                  Back to presets
                </button>

                <label className="block text-sm">
                  <span className="mb-1 block text-muted-foreground">Name</span>
                  <input
                    className="w-full rounded-md border border-border bg-background px-3 py-2"
                    value={configName}
                    onChange={(event) => setConfigName(event.target.value)}
                  />
                </label>

                <label className="block text-sm">
                  <span className="mb-1 block text-muted-foreground">Base URL</span>
                  <input
                    className="w-full rounded-md border border-border bg-background px-3 py-2"
                    value={configBaseUrl}
                    onChange={(event) => setConfigBaseUrl(event.target.value)}
                  />
                </label>

                {(configAuthType === 'api-key' || configAuthType === 'bearer') && (
                  <label className="block text-sm">
                    <span className="mb-1 block text-muted-foreground">API Key</span>
                    <div className="flex gap-2">
                      <input
                        className="w-full rounded-md border border-border bg-background px-3 py-2"
                        type={showApiKey ? 'text' : 'password'}
                        value={configApiKey}
                        onChange={(event) => setConfigApiKey(event.target.value)}
                      />
                      <button
                        className="rounded border border-border px-3 py-2 text-xs"
                        type="button"
                        onClick={() => setShowApiKey((current) => !current)}
                      >
                        {showApiKey ? 'Hide' : 'Show'}
                      </button>
                    </div>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      Stored securely in your OS keychain
                    </span>
                  </label>
                )}

                {testResult ? (
                  <div
                    className={`rounded-md border p-2 text-sm ${
                      testResult.ok
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200'
                        : 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200'
                    }`}
                  >
                    {testResult.ok
                      ? `Connection succeeded (${testResult.latencyMs}ms)`
                      : `Connection failed: ${testResult.error || 'Unknown error'}`}
                  </div>
                ) : null}

                {addError ? (
                  <div className="rounded-md border border-rose-300 bg-rose-50 p-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
                    {addError}
                  </div>
                ) : null}

                <div className="flex justify-end gap-2">
                  <button
                    className="rounded-md border border-border px-4 py-2 text-sm"
                    onClick={() => void onTestNewProvider()}
                    type="button"
                  >
                    Test Connection
                  </button>
                  <button
                    className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:bg-blue-300"
                    onClick={() => void onSaveProvider()}
                    type="button"
                    disabled={!canSaveAdd}
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <p className="mb-3 text-sm text-muted-foreground">Pick a preset</p>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
                  {PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      className="rounded-lg border border-border p-3 text-left hover:bg-accent"
                      onClick={() => onPresetSelect(preset)}
                      type="button"
                    >
                      <ProviderLogo name={preset.name} />
                      <p className="mt-2 text-xs font-medium">{preset.label}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {editingProvider ? (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/20">
          <aside className="h-full w-full max-w-md bg-background p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Edit Provider</h2>
              <button
                className="rounded border border-border px-2 py-1 text-xs"
                onClick={() => setEditingProvider(null)}
                type="button"
              >
                Close
              </button>
            </div>

            <div className="space-y-3">
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">Name</span>
                <input
                  className="w-full rounded-md border border-border bg-background px-3 py-2"
                  value={editingProvider.name}
                  onChange={(event) =>
                    setEditingProvider((current) =>
                      current ? { ...current, name: event.target.value } : current
                    )
                  }
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">Base URL</span>
                <input
                  className="w-full rounded-md border border-border bg-background px-3 py-2"
                  value={editingProvider.baseUrl}
                  onChange={(event) =>
                    setEditingProvider((current) =>
                      current ? { ...current, baseUrl: event.target.value } : current
                    )
                  }
                />
              </label>

              {(editingProvider.authType === 'api-key' || editingProvider.authType === 'bearer') && (
                <div className="rounded-md border border-border p-3">
                  <p className="text-xs text-muted-foreground">Current key: {editApiKeyHint}</p>
                  <label className="mt-2 block text-sm">
                    <span className="mb-1 block text-muted-foreground">New API Key</span>
                    <input
                      className="w-full rounded-md border border-border bg-background px-3 py-2"
                      value={editApiKey}
                      type="password"
                      onChange={(event) => setEditApiKey(event.target.value)}
                      placeholder="Enter to replace key"
                    />
                  </label>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                className="rounded-md border border-border px-4 py-2 text-sm"
                onClick={() => setEditingProvider(null)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white"
                onClick={() => void onSaveEdit()}
                type="button"
              >
                Save
              </button>
            </div>
          </aside>
        </div>
      ) : null}

      {removeTarget ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-background p-5 shadow-xl">
            <h3 className="text-lg font-semibold">Remove {removeTarget.name}?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              This will delete the provider and remove its API key from your keychain.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="rounded-md border border-border px-4 py-2 text-sm"
                onClick={() => setRemoveTarget(null)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700"
                onClick={() => void onRemoveProvider()}
                type="button"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
