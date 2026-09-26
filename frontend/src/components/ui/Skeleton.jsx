// Drawn in `surface-sunken`, one step darker than the page: a skeleton in the
// page colour (as this used to be) is invisible on every muted surface.
export function Skeleton({ className = 'h-4 w-full' }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-md bg-surface-sunken ${className}`} />
}
