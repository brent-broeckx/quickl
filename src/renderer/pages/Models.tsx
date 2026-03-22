import React, { useEffect, useMemo, useState } from 'react'
import type { LocalModel, OllamaRegistryModel } from '@shared/types'
import { useModelsStore } from '@renderer/stores/use-models.store'

type FamilyFilter = 'all' | 'llama' | 'mistral' | 'gemma' | 'phi' | 'codellama'
type SizeFilter = 'all' | 'small' | 'medium' | 'large'

function familyBadgeClass(family: string): string {
  const normalized = family.toLowerCase()
  if (normalized.includes('llama')) return 'bg-blue-100 text-blue-700'
  if (normalized.includes('mistral')) return 'bg-orange-100 text-orange-700'
  if (normalized.includes('gemma')) return 'bg-green-100 text-green-700'
  if (normalized.includes('phi')) return 'bg-purple-100 text-purple-700'
  if (normalized.includes('codellama')) return 'bg-yellow-100 text-yellow-800'
  return 'bg-zinc-100 text-zinc-700'
}

function statusClass(status: LocalModel['status']): string {
  if (status === 'loaded') return 'bg-emerald-600 text-white'
  if (status === 'downloading') return 'animate-pulse bg-blue-600 text-white'
  return 'border border-zinc-300 text-zinc-700'
}

function formatGbFromMb(value: number): string {
  return `${(value / 1024).toFixed(1)} GB`
}

function modelMatchesFamily(name: string, filter: FamilyFilter): boolean {
  if (filter === 'all') return true
  return name.toLowerCase().includes(filter)
}

function modelMatchesSize(sizes: string[], filter: SizeFilter): boolean {
  if (filter === 'all') return true
  const numericSizes = sizes
    .map((size) => Number.parseFloat(size.replace(/[^\d.]/g, '')))
    .filter((size) => Number.isFinite(size))

  if (numericSizes.length === 0) {
    return false
  }

  return numericSizes.some((size) => {
    if (filter === 'small') return size < 4
    if (filter === 'medium') return size >= 4 && size <= 13
    return size >= 14
  })
}

function truncate(text: string, max = 120): string {
  return text.length > max ? `${text.slice(0, max - 1)}...` : text
}

export function Models(): React.ReactElement {
  const [activeTab, setActiveTab] = useState<'installed' | 'discover'>('installed')
  const [search, setSearch] = useState('')
  const [discoverLoading, setDiscoverLoading] = useState(false)
  const [discoverResults, setDiscoverResults] = useState<OllamaRegistryModel[]>([])
  const [selectedVariant, setSelectedVariant] = useState<Record<string, string>>({})
  const [familyFilter, setFamilyFilter] = useState<FamilyFilter>('all')
  const [sizeFilter, setSizeFilter] = useState<SizeFilter>('all')
  const [pendingDelete, setPendingDelete] = useState<LocalModel | null>(null)
  const [newTagDrafts, setNewTagDrafts] = useState<Record<string, string>>({})
  const [startingOllama, setStartingOllama] = useState(false)

  const {
    models,
    resourceStats,
    pullProgress,
    ollamaStatus,
    loading,
    error,
    fetchModels,
    pullModel,
    deleteModel,
    loadModel,
    unloadModel,
    updatePullProgress,
    updateResourceStats,
    checkOllamaStatus,
    startOllama,
    startResourceMonitor,
    stopResourceMonitor,
    addTag,
    removeTag
  } = useModelsStore()

  useEffect(() => {
    void fetchModels()
    void checkOllamaStatus()
    void startResourceMonitor()

    const offPull = window.quickl.models.onPullProgress((progress) => {
      updatePullProgress(progress)
      if (progress.status === 'success' || progress.status === 'error') {
        void fetchModels()
        void checkOllamaStatus()
      }
    })

    const offStats = window.quickl.models.onResourceStats((stats) => {
      updateResourceStats(stats)
    })

    return () => {
      offPull()
      offStats()
      void stopResourceMonitor()
    }
  }, [checkOllamaStatus, fetchModels, startResourceMonitor, stopResourceMonitor, updatePullProgress, updateResourceStats])

  useEffect(() => {
    const timer = setTimeout(() => {
      setDiscoverLoading(true)
      void window.quickl.models
        .search(search)
        .then((results) => {
          setDiscoverResults(results)
        })
        .finally(() => {
          setDiscoverLoading(false)
        })
    }, 400)

    return () => clearTimeout(timer)
  }, [search])

  const loadedModels = useMemo(
    () => models.filter((model) => model.status === 'loaded'),
    [models]
  )

  const filteredDiscover = useMemo(
    () =>
      discoverResults.filter(
        (model) =>
          modelMatchesFamily(model.name, familyFilter) &&
          modelMatchesSize(model.sizes, sizeFilter)
      ),
    [discoverResults, familyFilter, sizeFilter]
  )

  const installedNames = useMemo(
    () => new Set(models.map((model) => model.name.split(':')[0].toLowerCase())),
    [models]
  )

  const remaining7bCapacity = useMemo(() => {
    if (!resourceStats || resourceStats.vramTotalMb === null || resourceStats.vramUsedMb === null) {
      return null
    }

    return Math.max(0, Math.floor((resourceStats.vramTotalMb - resourceStats.vramUsedMb) / 4096))
  }, [resourceStats])

  const startOllamaAction = async (): Promise<void> => {
    setStartingOllama(true)
    try {
      await startOllama()
      await fetchModels()
      await checkOllamaStatus()
    } finally {
      setStartingOllama(false)
    }
  }

  const showStartBanner = ollamaStatus === 'stopped' || ollamaStatus === 'unknown'

  const statusBadgeClass =
    ollamaStatus === 'running'
      ? 'bg-emerald-100 text-emerald-700'
      : ollamaStatus === 'stopped'
        ? 'bg-amber-100 text-amber-700'
        : ollamaStatus === 'not-installed'
          ? 'bg-rose-100 text-rose-700'
          : 'bg-zinc-100 text-zinc-700'

  const handleLoad = async (name: string): Promise<void> => {
    await loadModel(name)
    await fetchModels()
    await checkOllamaStatus()
  }

  const handleUnload = async (name: string): Promise<void> => {
    await unloadModel(name)
    await fetchModels()
    await checkOllamaStatus()
  }

  const handleDelete = async (runtime: string, name: string): Promise<void> => {
    await deleteModel(runtime, name)
    await fetchModels()
    await checkOllamaStatus()
  }

  const renderInstalled = (): React.ReactElement => (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr,320px]">
      <section className="space-y-4">
        {loading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-48 animate-pulse rounded-xl border border-border bg-card" />
            ))}
          </div>
        ) : models.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-6 text-center">
            <h3 className="text-lg font-semibold">No models installed yet</h3>
            <button
              className="mt-3 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              onClick={() => setActiveTab('discover')}
              type="button"
            >
              Go to Discover
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {models.map((model) => {
              const progress = pullProgress[model.name]
              return (
                <article key={model.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold">{model.name}</h3>
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusClass(model.status)}`}>
                      {model.status[0].toUpperCase() + model.status.slice(1)}
                    </span>
                  </div>

                  <div className="mb-3 flex flex-wrap gap-2 text-xs">
                    <span className={`rounded-full px-2 py-1 ${familyBadgeClass(model.family)}`}>{model.family}</span>
                    {model.parameterSize && (
                      <span className="rounded-full bg-zinc-100 px-2 py-1 text-zinc-700">{model.parameterSize}</span>
                    )}
                    {model.quantization && (
                      <span className="rounded-full bg-zinc-100 px-2 py-1 text-zinc-700">{model.quantization.toUpperCase()}</span>
                    )}
                    <span className="ml-auto rounded-full bg-zinc-100 px-2 py-1 text-zinc-700">
                      {model.runtime === 'ollama' ? 'Ollama' : 'LM Studio'}
                    </span>
                  </div>

                  <p className="mb-2 text-xs text-muted-foreground">Disk size: {formatGbFromMb(model.sizeMb)}</p>

                  {model.status === 'loaded' && model.vramUsageMb !== null && resourceStats?.vramTotalMb ? (
                    <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-zinc-200">
                      <div
                        className="h-full bg-emerald-500"
                        style={{ width: `${Math.min(100, Math.round((model.vramUsageMb / resourceStats.vramTotalMb) * 100))}%` }}
                      />
                    </div>
                  ) : null}

                  {progress && model.status === 'downloading' ? (
                    <div className="mb-3 rounded-md border border-blue-200 bg-blue-50 p-2 text-xs text-blue-700">
                      {progress.status} {progress.progress}%
                    </div>
                  ) : null}

                  <div className="mb-3 flex flex-wrap gap-2">
                    {model.status === 'available' ? (
                      <button
                        className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700"
                        onClick={() => void handleLoad(model.name)}
                        type="button"
                      >
                        Load
                      </button>
                    ) : null}
                    {model.status === 'loaded' ? (
                      <button
                        className="rounded-md bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-700"
                        onClick={() => void handleUnload(model.name)}
                        type="button"
                      >
                        Unload
                      </button>
                    ) : null}
                    <button
                      className="rounded-md bg-rose-600 px-3 py-1 text-xs font-medium text-white hover:bg-rose-700"
                      onClick={() => setPendingDelete(model)}
                      type="button"
                    >
                      Delete
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {model.tags.map((tag) => (
                      <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-1 text-xs">
                        {tag}
                        <button type="button" onClick={() => void removeTag(model.id, tag)}>
                          x
                        </button>
                      </span>
                    ))}
                    <input
                      className="w-24 rounded border border-border px-2 py-1 text-xs"
                      value={newTagDrafts[model.id] ?? ''}
                      onChange={(event) =>
                        setNewTagDrafts((current) => ({ ...current, [model.id]: event.target.value }))
                      }
                      placeholder="+ tag"
                    />
                    <button
                      className="rounded border border-border px-2 py-1 text-xs"
                      onClick={() => {
                        const tag = (newTagDrafts[model.id] ?? '').trim()
                        if (tag) {
                          void addTag(model.id, tag)
                          setNewTagDrafts((current) => ({ ...current, [model.id]: '' }))
                        }
                      }}
                      type="button"
                    >
                      Add
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      <aside className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <h3 className="mb-3 text-base font-semibold">Resource Monitor</h3>
        {!resourceStats ? (
          <p className="text-sm text-muted-foreground">Waiting for stats...</p>
        ) : (
          <div className="space-y-4 text-sm">
            <div>
              <div className="mb-1 flex justify-between"><span>RAM</span><span>{formatGbFromMb(resourceStats.ramUsedMb)} / {formatGbFromMb(resourceStats.ramTotalMb)}</span></div>
              <div className="h-2 rounded-full bg-zinc-200"><div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.round((resourceStats.ramUsedMb / resourceStats.ramTotalMb) * 100)}%` }} /></div>
            </div>

            <div>
              <div className="mb-1 flex justify-between"><span>VRAM</span><span>{resourceStats.vramTotalMb === null || resourceStats.vramUsedMb === null ? 'No GPU detected' : `${formatGbFromMb(resourceStats.vramUsedMb)} / ${formatGbFromMb(resourceStats.vramTotalMb)}`}</span></div>
              {resourceStats.vramTotalMb !== null && resourceStats.vramUsedMb !== null ? (
                <div className="h-2 rounded-full bg-zinc-200"><div className="h-full rounded-full bg-violet-500" style={{ width: `${Math.round((resourceStats.vramUsedMb / resourceStats.vramTotalMb) * 100)}%` }} /></div>
              ) : null}
            </div>

            <div>
              <div className="mb-1 flex justify-between"><span>CPU</span><span>{resourceStats.cpuPercent}%</span></div>
              <div className="h-2 rounded-full bg-zinc-200"><div className="h-full rounded-full bg-amber-500" style={{ width: `${resourceStats.cpuPercent}%` }} /></div>
            </div>

            <div>
              <p className="mb-1 font-medium">Loaded models</p>
              {loadedModels.length === 0 ? (
                <p className="text-xs text-muted-foreground">No models loaded.</p>
              ) : (
                <ul className="space-y-1 text-xs">
                  {loadedModels.map((model) => (
                    <li key={model.id} className="flex justify-between">
                      <span>{model.name}</span>
                      <span>{model.vramUsageMb ? `${Math.round(model.vramUsageMb)} MB` : '-'}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              Estimated capacity: {remaining7bCapacity === null ? 'Unavailable' : `~${remaining7bCapacity} more 7B models can fit`}
            </p>
          </div>
        )}
      </aside>
    </div>
  )

  const renderDiscover = (): React.ReactElement => (
    <section>
      <div className="mb-4">
        <input
          className="w-full rounded-md border border-border bg-background px-3 py-2"
          placeholder="Search models"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <div className="mb-4 flex flex-wrap gap-2 text-xs">
        {(['all', 'llama', 'mistral', 'gemma', 'phi', 'codellama'] as FamilyFilter[]).map((option) => (
          <button
            key={option}
            type="button"
            className={`rounded-full px-3 py-1 ${familyFilter === option ? 'bg-blue-600 text-white' : 'border border-border'}`}
            onClick={() => setFamilyFilter(option)}
          >
            {option[0].toUpperCase() + option.slice(1)}
          </button>
        ))}
        {(['all', 'small', 'medium', 'large'] as SizeFilter[]).map((option) => (
          <button
            key={option}
            type="button"
            className={`rounded-full px-3 py-1 ${sizeFilter === option ? 'bg-emerald-600 text-white' : 'border border-border'}`}
            onClick={() => setSizeFilter(option)}
          >
            {option === 'small' ? 'Small <4B' : option === 'medium' ? 'Medium 4-13B' : option === 'large' ? 'Large 14B+' : 'All'}
          </button>
        ))}
      </div>

      {discoverLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-40 animate-pulse rounded-xl border border-border bg-card" />
          ))}
        </div>
      ) : filteredDiscover.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-6 text-center text-muted-foreground">
          No models found for {search || 'your query'}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredDiscover.map((model) => {
            const variant = selectedVariant[model.name] ?? model.sizes[0] ?? 'latest'
            const fullName = `${model.name}:${variant}`
            const progress = pullProgress[fullName] ?? pullProgress[model.name]
            const pulling = progress && progress.progress < 100 && progress.status !== 'error'
            return (
              <article key={model.name} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">{model.name}</h3>
                  {installedNames.has(model.name.toLowerCase()) ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-700">Installed</span>
                  ) : null}
                </div>
                <p className="mb-3 text-xs text-muted-foreground">{truncate(model.description)}</p>
                <p className="mb-3 text-xs text-muted-foreground">{model.pulls >= 1_000_000 ? `${(model.pulls / 1_000_000).toFixed(1)}M pulls` : `${Math.round(model.pulls / 1000)}K pulls`}</p>

                <div className="mb-3 flex flex-wrap gap-2">
                  {model.sizes.map((size) => (
                    <button
                      key={size}
                      type="button"
                      className={`rounded-full border px-2 py-1 text-xs ${variant === size ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-border'}`}
                      onClick={() => setSelectedVariant((current) => ({ ...current, [model.name]: size }))}
                    >
                      {size}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  className="w-full rounded-md bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700"
                  onClick={() => void pullModel(fullName)}
                  disabled={Boolean(pulling)}
                >
                  {pulling ? `Pulling ${progress.progress}%` : 'Pull'}
                </button>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-8">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h1 className="text-3xl font-bold">Local Models</h1>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Ollama</span>
            <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusBadgeClass}`}>
              {ollamaStatus}
            </span>
            <button
              className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
              type="button"
              onClick={() => void checkOllamaStatus()}
              disabled={startingOllama}
            >
              Refresh
            </button>
          </div>
        </div>

        {ollamaStatus === 'not-installed' ? (
          <div className="mb-4 rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-700">
            Ollama is not installed. Download it at{' '}
            <button className="underline" onClick={() => void window.quickl.system.openExternal('https://ollama.com')} type="button">
              ollama.com
            </button>
          </div>
        ) : null}
        {showStartBanner ? (
          <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
            <div className="flex items-center justify-between gap-3">
              <span>
                {ollamaStatus === 'unknown'
                  ? 'Ollama status is unknown. You can retry status check or start Ollama.'
                  : 'Ollama is not running'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  className="rounded-md border border-amber-500 px-3 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100"
                  onClick={() => void checkOllamaStatus()}
                  type="button"
                  disabled={startingOllama}
                >
                  Check status
                </button>
                <button
                  className="rounded-md bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-700"
                  onClick={() => void startOllamaAction()}
                  type="button"
                  disabled={startingOllama}
                >
                  {startingOllama ? 'Starting...' : 'Start Ollama'}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {error ? <p className="mb-4 text-sm text-rose-600">{error}</p> : null}

        <div className="mb-5 flex gap-2">
          <button
            type="button"
            className={`rounded-md px-4 py-2 text-sm font-medium ${activeTab === 'installed' ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'border border-border'}`}
            onClick={() => setActiveTab('installed')}
          >
            Installed
          </button>
          <button
            type="button"
            className={`rounded-md px-4 py-2 text-sm font-medium ${activeTab === 'discover' ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'border border-border'}`}
            onClick={() => setActiveTab('discover')}
          >
            Discover
          </button>
        </div>

        {activeTab === 'installed' ? renderInstalled() : renderDiscover()}

        {pendingDelete ? (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-xl bg-background p-5 shadow-xl">
              <h3 className="text-lg font-semibold">Delete model?</h3>
              <p className="mt-2 text-sm text-muted-foreground">This will remove {pendingDelete.name} from {pendingDelete.runtime}.</p>
              <div className="mt-4 flex justify-end gap-2">
                <button className="rounded-md border border-border px-3 py-2 text-sm" onClick={() => setPendingDelete(null)} type="button">Cancel</button>
                <button
                  className="rounded-md bg-rose-600 px-3 py-2 text-sm text-white"
                  onClick={() => {
                    void handleDelete(pendingDelete.runtime, pendingDelete.name).then(() => {
                      setPendingDelete(null)
                    })
                  }}
                  type="button"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
