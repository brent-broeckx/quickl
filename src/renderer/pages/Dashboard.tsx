import React from 'react'
import { EmptyState } from '@renderer/components/EmptyState'

export function Dashboard(): React.ReactElement {
  return (
    <div className="flex-1 overflow-auto">
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-8">Dashboard</h1>
        <EmptyState
          title="Dashboard"
          description="Get an overview of all your AI infrastructure, provider health, and system status."
        />
      </div>
    </div>
  )
}
