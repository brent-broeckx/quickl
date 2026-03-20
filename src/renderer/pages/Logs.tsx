import React from 'react'
import { EmptyState } from '@renderer/components/EmptyState'

export function Logs(): React.ReactElement {
  return (
    <div className="flex-1 overflow-auto">
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-8">Logs & Diagnostics</h1>
        <EmptyState
          title="No Logs Yet"
          description="System logs and diagnostics will appear here as you use Quickl."
        />
      </div>
    </div>
  )
}
