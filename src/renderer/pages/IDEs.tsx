import React from 'react'
import { EmptyState } from '@renderer/components/EmptyState'

export function IDEs(): React.ReactElement {
  return (
    <div className="flex-1 overflow-auto">
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-8">IDEs</h1>
        <EmptyState
          title="No IDEs Detected"
          description="Quickl will auto-configure your IDEs to use the local proxy gateway once you scan for them."
          actionLabel="Scan for IDEs"
        />
      </div>
    </div>
  )
}
