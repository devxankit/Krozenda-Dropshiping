import { useEffect, useState } from 'react'
import { Button } from '../../../../components/ui'
import { formatRelativeTime } from '../../lib/format'

// "Updated 2 min ago", plus a manual refresh. The screens behind this re-read
// themselves on a timer, so this stamp is the only thing telling a reader
// whether what they are looking at is a minute old or an hour old.
export function RefreshControl({ updatedAt, isFetching = false, onRefresh, live = true }) {
  const [, setTick] = useState(0)

  // Re-renders on a slow interval so the relative stamp ages in place. It
  // does not fetch anything — the controller owns the polling.
  useEffect(() => {
    if (!updatedAt) return undefined
    const id = setInterval(() => setTick((value) => value + 1), 15_000)
    return () => clearInterval(id)
  }, [updatedAt])

  const stamp = formatRelativeTime(updatedAt)

  return (
    <span className="flex items-center gap-2">
      <span className="hidden items-center gap-1.5 text-2xs text-ink-faint sm:flex">
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            isFetching ? 'animate-pulse bg-brand-500' : live ? 'bg-success-500' : 'bg-border-strong'
          }`}
        />
        {isFetching ? 'Refreshing…' : stamp ? `Updated ${stamp}` : 'Sample data'}
      </span>
      <Button
        variant="secondary"
        size="control"
        icon="refresh"
        iconOnly
        isLoading={isFetching}
        onClick={onRefresh}
        aria-label="Refresh now"
        title="Refresh now"
      />
    </span>
  )
}
