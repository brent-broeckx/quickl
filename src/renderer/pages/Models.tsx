import React from 'react'
import { EmptyState } from '@renderer/components/EmptyState'

export function Models(): React.ReactElement {
  return (
    <div className="flex-1 overflow-auto">
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-8">Local Models</h1>
        <EmptyState
          title="No Local Models"
          description="Download and manage local models from Ollama, LM Studio, and other runtimes."
        />
      </div>
    </div>
  )
}
