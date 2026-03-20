import React from 'react'
import { EmptyState } from '@renderer/components/EmptyState'

export function Settings(): React.ReactElement {
  return (
    <div className="flex-1 overflow-auto">
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-8">Settings</h1>
        <EmptyState
          title="Settings"
          description="Configure Quickl preferences, proxy ports, notifications, and more."
        />
      </div>
    </div>
  )
}
