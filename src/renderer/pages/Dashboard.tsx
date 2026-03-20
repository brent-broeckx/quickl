import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Provider } from '@shared/types'
import { useProvidersStore } from '@renderer/stores/use-providers.store'

type ActivityEvent = {
  id: string
  timestamp: string
  message: string
}

function healthSummaryClass(providers: Provider[]): string {
  if (providers.some((provider) => provider.status === 'offline')) {
    return 'border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40'
  }

  if (providers.some((provider) => provider.status === 'degraded')) {
    return 'border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40'
  }

  return 'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40'
}

export function Dashboard(): React.ReactElement {
  const navigate = useNavigate()
  const providers = useProvidersStore((state) => state.providers)
  const fetchProviders = useProvidersStore((state) => state.fetchProviders)
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const previousProvidersRef = useRef<Provider[]>([])

  useEffect(() => {
    void fetchProviders()
  }, [fetchProviders])

  useEffect(() => {
    const previousById = new Map(previousProvidersRef.current.map((provider) => [provider.id, provider]))
    const currentById = new Map(providers.map((provider) => [provider.id, provider]))
    const nextEvents: ActivityEvent[] = []

    for (const provider of providers) {
      const previous = previousById.get(provider.id)
      if (!previous) {
        nextEvents.push({
          id: `${provider.id}-added-${Date.now()}`,
          timestamp: new Date().toISOString(),
          message: `Provider ${provider.name} added`
        })
        continue
      }

      if (previous.status !== provider.status) {
        if (provider.status === 'online') {
          nextEvents.push({
            id: `${provider.id}-online-${Date.now()}`,
            timestamp: new Date().toISOString(),
            message: `Provider ${provider.name} came online`
          })
        }

        if (provider.status === 'offline') {
          nextEvents.push({
            id: `${provider.id}-offline-${Date.now()}`,
            timestamp: new Date().toISOString(),
            message: `Provider ${provider.name} went offline`
          })
        }
      }
    }

    for (const previous of previousProvidersRef.current) {
      if (!currentById.has(previous.id)) {
        nextEvents.push({
          id: `${previous.id}-removed-${Date.now()}`,
          timestamp: new Date().toISOString(),
          message: `Provider ${previous.name} removed`
        })
      }
    }

    if (nextEvents.length > 0) {
      setEvents((current) => [...nextEvents, ...current].slice(0, 20))
    }

    previousProvidersRef.current = providers
  }, [providers])

  const onlineCount = useMemo(
    () => providers.filter((provider) => provider.status === 'online').length,
    [providers]
  )

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-8">
        <h1 className="mb-8 text-3xl font-bold">Dashboard</h1>

        <section className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <button
            className={`rounded-xl border p-5 text-left shadow-sm ${healthSummaryClass(providers)}`}
            onClick={() => navigate('/providers')}
            type="button"
          >
            <p className="text-sm font-medium text-muted-foreground">Providers</p>
            <p className="mt-2 text-3xl font-semibold">{providers.length}</p>
            <p className="mt-2 text-sm text-muted-foreground">Healthy: {onlineCount}</p>
          </button>
        </section>

        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Activity Feed</h2>
            <span className="text-xs text-muted-foreground">Last {events.length} events</span>
          </div>

          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">No provider events yet.</p>
          ) : (
            <ul className="space-y-2">
              {events.map((event) => (
                <li key={event.id} className="rounded-md bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-900">
                  <div className="font-medium">{event.message}</div>
                  <div className="text-xs text-muted-foreground">{new Date(event.timestamp).toLocaleString()}</div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
