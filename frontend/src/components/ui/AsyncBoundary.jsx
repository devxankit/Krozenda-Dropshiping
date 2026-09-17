
// The buyer screens each invented their own "Loading your orders..." /
// "Something went wrong" treatment, and several had no error branch at all —
// a failed fetch rendered as a permanently empty list, which reads to a user
// as "you have nothing here" rather than "this did not load".
//
// These four states (loading / error / empty / content) are what every list
// screen in the app actually needs, so they live in one place with one visual
// language.

export function ErrorState({ error, title, description, onRetry, className = '' }) {
  // The API layer already produces a human message per failure kind (offline,
  // timeout, 5xx, or the server's own wording). Showing it beats replacing
  // every failure with one generic sentence.
  const offline = error?.isOffline || error?.code === 'OFFLINE'
  const heading = title || (offline ? "You're offline" : 'That didn’t load')
  const body =
    description || error?.message || 'Something went wrong while loading this. Please try again.'

  return (
    <div
      role="alert"
      className={`flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center sm:p-10 ${className}`}
    >
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-full text-xl ${
          offline ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-500'
        }`}
        aria-hidden="true"
      >
        {offline ? '⚡' : '⚠'}
      </div>
      <div className="space-y-1">
        <p className="text-sm font-bold text-slate-900">{heading}</p>
        <p className="mx-auto max-w-sm text-xs text-slate-500">{body}</p>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        >
          Try again
        </button>
      )}
    </div>
  )
}

export function EmptyResult({ icon = '📭', title, description, action, className = '' }) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center sm:p-10 ${className}`}
    >
      <div
        className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-2xl"
        aria-hidden="true"
      >
        {icon}
      </div>
      <div className="space-y-1">
        <p className="text-sm font-bold text-slate-900">{title}</p>
        {description && <p className="mx-auto max-w-sm text-xs text-slate-500">{description}</p>}
      </div>
      {action}
    </div>
  )
}

// Skeletons whose shape matches what they replace, so the page does not jump
// when the real content arrives.
export function ProductGridSkeleton({ count = 8, className = '' }) {
  return (
    <div
      className={`grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 ${className}`}
      aria-busy="true"
      aria-label="Loading products"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="aspect-square animate-pulse bg-slate-100" />
          <div className="space-y-2 p-3">
            <div className="h-3 w-4/5 animate-pulse rounded bg-slate-100" />
            <div className="h-3 w-3/5 animate-pulse rounded bg-slate-100" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function ListSkeleton({ count = 4, className = '' }) {
  return (
    <div className={`space-y-3 ${className}`} aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="h-16 w-16 shrink-0 animate-pulse rounded-xl bg-slate-100" />
          <div className="flex-1 space-y-2 py-1">
            <div className="h-3 w-3/4 animate-pulse rounded bg-slate-100" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-slate-100" />
            <div className="h-4 w-1/3 animate-pulse rounded bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  )
}

// Renders exactly one of loading / error / empty / children, so a screen can
// never show "no results" while a request is still in flight — which is what
// several of these screens did.
export function AsyncBoundary({ isLoading, error, isEmpty, onRetry, skeleton, empty, children }) {
  if (isLoading) return skeleton ?? <ListSkeleton />
  if (error) return <ErrorState error={error} onRetry={onRetry} />
  if (isEmpty) return empty ?? <EmptyResult title="Nothing here yet" />
  return children
}
