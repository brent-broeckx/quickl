import React from 'react'
import { EmptyState } from '@renderer/components/EmptyState'

export function MCP(): React.ReactElement {
  return (
    <div className="flex-1 overflow-auto">
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-8">MCP Servers</h1>
        <EmptyState
          title="No MCP Servers"
          description="Model Context Protocol servers extend agent capabilities. Install them from the built-in catalog."
          actionLabel="Add MCP Server"
        />
      </div>
    </div>
  )
}
