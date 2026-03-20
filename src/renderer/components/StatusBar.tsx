import React from 'react'

interface StatusBarProps {
  version: string
}

export function StatusBar({ version }: StatusBarProps): React.ReactElement {
  return (
    <div className="h-12 bg-muted border-t border-border flex items-center px-6 space-x-8 text-sm">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">Active Provider:</span>
        <span className="text-foreground font-medium">No provider</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">Proxy Status:</span>
        <span className="text-foreground font-medium">Proxy offline</span>
      </div>
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
