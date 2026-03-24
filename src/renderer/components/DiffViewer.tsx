import React, { useMemo } from 'react'

type DiffViewerProps = {
  before: string
  after: string
}

type DiffStats = {
  changed: number
  unchanged: number
}

function splitLines(text: string): string[] {
  if (!text) {
    return []
  }
  return text.replace(/\r\n/g, '\n').split('\n')
}

function computeStats(beforeLines: string[], afterLines: string[]): DiffStats {
  const max = Math.max(beforeLines.length, afterLines.length)
  let changed = 0
  let unchanged = 0

  for (let index = 0; index < max; index += 1) {
    const before = beforeLines[index] ?? ''
    const after = afterLines[index] ?? ''
    if (before === after) {
      unchanged += 1
    } else {
      changed += 1
    }
  }

  return { changed, unchanged }
}

export function DiffViewer({ before, after }: Readonly<DiffViewerProps>): React.ReactElement {
  const beforeLines = useMemo(() => splitLines(before), [before])
  const afterLines = useMemo(() => splitLines(after), [after])
  const stats = useMemo(() => computeStats(beforeLines, afterLines), [beforeLines, afterLines])

  const maxRows = Math.max(beforeLines.length, afterLines.length)

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3 text-xs text-muted-foreground">
        <span>Changed lines: {stats.changed}</span>
        <span>Unchanged lines: {stats.unchanged}</span>
      </div>

      <div className="grid max-h-[420px] grid-cols-2 overflow-auto">
        <div className="border-r border-border">
          <div className="sticky top-0 border-b border-border bg-zinc-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide dark:bg-zinc-900">
            Before
          </div>
          {Array.from({ length: maxRows }).map((_, index) => {
            const line = beforeLines[index] ?? ''
            const other = afterLines[index] ?? ''
            const changed = line !== other

            return (
              <div
                key={`before-${index}`}
                className={`flex gap-3 px-3 py-1 text-xs ${
                  changed ? 'bg-rose-50 dark:bg-rose-950/20' : 'bg-transparent'
                }`}
              >
                <span className="w-8 shrink-0 text-right text-muted-foreground">{index + 1}</span>
                <pre className="m-0 whitespace-pre-wrap break-all font-mono">{line}</pre>
              </div>
            )
          })}
        </div>

        <div>
          <div className="sticky top-0 border-b border-border bg-zinc-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide dark:bg-zinc-900">
            After
          </div>
          {Array.from({ length: maxRows }).map((_, index) => {
            const line = afterLines[index] ?? ''
            const other = beforeLines[index] ?? ''
            const changed = line !== other

            return (
              <div
                key={`after-${index}`}
                className={`flex gap-3 px-3 py-1 text-xs ${
                  changed ? 'bg-emerald-50 dark:bg-emerald-950/20' : 'bg-transparent'
                }`}
              >
                <span className="w-8 shrink-0 text-right text-muted-foreground">{index + 1}</span>
                <pre className="m-0 whitespace-pre-wrap break-all font-mono">{line}</pre>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
