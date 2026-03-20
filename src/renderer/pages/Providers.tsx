import React from 'react'
import { EmptyState } from '@renderer/components/EmptyState'

export function Providers(): React.ReactElement {
  return (
    <div className="flex-1 overflow-auto">
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-8">Providers</h1>
        <EmptyState
          title="No Providers"
          description="Add cloud AI providers like OpenAI, Anthropic, or configure local endpoints."
          actionLabel="Add Provider"
        />
      </div>
    </div>
  )
}
