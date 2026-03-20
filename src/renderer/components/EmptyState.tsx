import React from 'react'

interface EmptyStateProps {
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
}

/**
 * Reusable empty state component
 */
export function EmptyState({
  title,
  description,
  actionLabel,
  onAction
}: EmptyStateProps): React.ReactElement {
  return (
    <div className="flex flex-col items-center justify-center h-full py-12">
      <div className="text-center space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">{title}</h2>
        <p className="text-muted-foreground max-w-sm">{description}</p>
        {actionLabel && onAction && (
          <button
            onClick={onAction}
            className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity"
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  )
}
