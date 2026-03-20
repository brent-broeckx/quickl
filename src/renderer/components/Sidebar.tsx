import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

interface NavItem {
  label: string
  path: string
  key: string
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', path: '/', key: 'DB' },
  { label: 'Providers', path: '/providers', key: 'PR' },
  { label: 'Models', path: '/models', key: 'MD' },
  { label: 'IDEs', path: '/ides', key: 'ID' },
  { label: 'MCP', path: '/mcp', key: 'MP' },
  { label: 'Guardrails', path: '/guardrails', key: 'GR' },
  { label: 'Logs', path: '/logs', key: 'LG' },
  { label: 'Settings', path: '/settings', key: 'ST' }
]

interface SidebarProps {
  theme: 'light' | 'dark' | 'system'
  onThemeChange: (theme: 'light' | 'dark' | 'system') => void
}

export function Sidebar({ theme, onThemeChange }: SidebarProps): React.ReactElement {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <div className="w-64 bg-secondary border-r border-border flex flex-col h-full">
      <div className="p-6 border-b border-border">
        <h1 className="text-2xl font-bold text-foreground">Quickl</h1>
        <p className="text-sm text-muted-foreground">AI Control Panel</p>
      </div>

      <nav className="flex-1 overflow-y-auto p-4">
        <ul className="space-y-2">
          {NAV_ITEMS.map((item) => (
            <li key={item.path}>
              <button
                onClick={() => navigate(item.path)}
                className={`w-full text-left px-4 py-2 rounded-md transition-colors ${
                  location.pathname === item.path
                    ? 'bg-primary text-primary-foreground'
                    : 'text-foreground hover:bg-muted'
                }`}
              >
                <span className="mr-3 text-xs opacity-70">{item.key}</span>
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="p-4 border-t border-border">
        <label className="text-xs text-muted-foreground block mb-2">Theme</label>
        <select
          value={theme}
          onChange={(event) => onThemeChange(event.target.value as 'light' | 'dark' | 'system')}
          className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
        >
          <option value="system">System</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </div>
    </div>
  )
}
