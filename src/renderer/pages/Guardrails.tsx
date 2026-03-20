import React from 'react'
import { EmptyState } from '@renderer/components/EmptyState'

export function Guardrails(): React.ReactElement {
  return (
    <div className="flex-1 overflow-auto">
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-8">Guardrails</h1>
        <EmptyState
          title="No Active Guardrails"
          description="Define rules to control what agents can access and execute. Create a profile to get started."
        />
      </div>
    </div>
  )
}
