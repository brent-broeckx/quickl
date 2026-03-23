import React, { useEffect, useState } from 'react'
import { HashRouter as Router, Route, Routes, useNavigate } from 'react-router-dom'
import { Sidebar } from '@renderer/components/Sidebar'
import { StatusBar } from '@renderer/components/StatusBar'
import { Dashboard } from '@renderer/pages/Dashboard'
import { Providers } from '@renderer/pages/Providers'
import { Models } from '@renderer/pages/Models'
import { IDEs } from '@renderer/pages/IDEs'
import { MCP } from '@renderer/pages/MCP'
import { Guardrails } from '@renderer/pages/Guardrails'
import { Logs } from '@renderer/pages/Logs'
import { Settings } from '@renderer/pages/Settings'
import { useProxyStore } from '@renderer/stores/use-proxy.store'

type ConflictBannerProps = {
  message: string
  onDismiss: () => void
}

function ConflictBanner({ message, onDismiss }: Readonly<ConflictBannerProps>): React.ReactElement {
  const navigate = useNavigate()

  return (
    <div className="border-b border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
      <div className="flex flex-wrap items-center gap-3">
        <span>{message}</span>
        <button
          className="rounded-md bg-amber-700 px-3 py-1 text-xs text-white hover:bg-amber-600"
          onClick={() => navigate('/settings?section=proxy')}
          type="button"
        >
          Open Settings
        </button>
        <button className="text-xs underline" onClick={onDismiss} type="button">
          Dismiss
        </button>
      </div>
    </div>
  )
}

/**
 * Main application shell with sidebar navigation, router, and status bar
 */
function App(): React.ReactElement {
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system')
  const [version, setVersion] = useState<string>('0.0.0')
  const conflict = useProxyStore((state) => state.conflict)
  const dismissConflict = useProxyStore((state) => state.dismissConflict)
  const startPolling = useProxyStore((state) => state.startPolling)

  useEffect(() => {
    const loadTheme = async (): Promise<void> => {
      const savedTheme = await window.quicklTheme.getTheme()
      setTheme(savedTheme)
    }

    const loadVersion = async (): Promise<void> => {
      const appVersion = await window.quickl.system.getVersion()
      setVersion(appVersion)
    }

    void loadTheme()
    void loadVersion()

    const stopPolling = startPolling()
    return () => stopPolling()
  }, [startPolling])

  // Initialize theme from system preference
  useEffect(() => {
    const prefersDark = globalThis.matchMedia('(prefers-color-scheme: dark)').matches
    const htmlElement = document.documentElement

    // Apply theme on mount
    if (theme === 'dark' || (theme === 'system' && prefersDark)) {
      htmlElement.style.colorScheme = 'dark'
    } else {
      htmlElement.style.colorScheme = 'light'
    }

    // Listen for system theme changes
    const mediaQuery = globalThis.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (e: MediaQueryListEvent): void => {
      if (theme === 'system') {
        htmlElement.style.colorScheme = e.matches ? 'dark' : 'light'
      }
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [theme])

  const handleThemeChange = (nextTheme: 'light' | 'dark' | 'system'): void => {
    setTheme(nextTheme)
    void window.quicklTheme.setTheme(nextTheme)
  }

  return (
    <Router>
      <div className="flex h-screen w-screen bg-background text-foreground">
        <Sidebar theme={theme} onThemeChange={handleThemeChange} />
        <div className="flex flex-col flex-1">
          {conflict ? <ConflictBanner message={conflict.message} onDismiss={dismissConflict} /> : null}
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/providers" element={<Providers />} />
            <Route path="/models" element={<Models />} />
            <Route path="/ides" element={<IDEs />} />
            <Route path="/mcp" element={<MCP />} />
            <Route path="/guardrails" element={<Guardrails />} />
            <Route path="/logs" element={<Logs />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
          <StatusBar version={version} />
        </div>
      </div>
    </Router>
  )
}

export default App
