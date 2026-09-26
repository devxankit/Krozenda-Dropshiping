import { Button, Icon, Skeleton } from '../../../../components/ui'
import { useAuthStore } from '../../../../lib/authStore'

// Rule 09: every screen has a loading, empty, error and loaded state. These
// are the shared three, so a screen only ever has to supply its own empty.

const ALERT_TONE = Object.freeze({
  info: 'border-brand-200 bg-brand-50 text-brand-700',
  success: 'border-success-200 bg-success-50 text-success-700',
  warning: 'border-warning-200 bg-warning-50 text-warning-700',
  danger: 'border-danger-200 bg-danger-50 text-danger-700',
})

const ALERT_ICON = Object.freeze({
  info: 'info',
  success: 'successCircle',
  warning: 'warning',
  danger: 'danger',
})

export function InlineAlert({ tone = 'info', title, children, action, className = '' }) {
  return (
    <div
      role={tone === 'danger' || tone === 'warning' ? 'alert' : 'status'}
      className={`flex flex-wrap items-start gap-2.5 rounded-lg border px-3.5 py-3 sm:flex-nowrap ${ALERT_TONE[tone]} ${className}`}
    >
      <Icon name={ALERT_ICON[tone]} className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1 text-xs leading-relaxed">
        {title && <p className="font-semibold">{title}</p>}
        {children}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

export function ErrorState({ error, onRetry, title = 'This did not load' }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-danger-200 bg-danger-50/40 px-6 py-12 text-center"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-danger-50 text-danger-500 ring-1 ring-inset ring-danger-200">
        <Icon name="danger" className="h-6 w-6" />
      </span>
      <div>
        <p className="text-base font-semibold text-slate-900">{title}</p>
        <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-ink-subtle">
          {error?.message || 'Something went wrong on our side. Try again in a moment.'}
        </p>
      </div>
      {onRetry && (
        <Button variant="secondary" size="control" icon="refresh" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}

// Mirrors the real page — header, KPI row, a wide panel beside a narrow one —
// so the layout does not jump when the data lands.
export function PageSkeleton({ rows = 4 }) {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-3 w-80 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={`tile-${index}`}
            className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-card"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-card">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-56 w-full" />
        </div>
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-card">
          <Skeleton className="h-4 w-32" />
          {Array.from({ length: rows }, (_, index) => (
            <Skeleton key={`row-${index}`} className="h-10 w-full" />
          ))}
        </div>
      </div>
    </div>
  )
}

// Hides an action the signed-in role cannot perform. `fallback` is for the
// cases where a disabled control communicates more than a missing one.
export function PermissionGate({ permission, permissions = [], mode = 'any', fallback = null, children }) {
  const granted = useAuthStore((state) => state.permissions)
  const required = permission ? [permission] : permissions

  if (required.length === 0) return children

  const allowed =
    mode === 'all'
      ? required.every((item) => granted.includes(item))
      : required.some((item) => granted.includes(item))

  return allowed ? children : fallback
}

// An empty RESULT, not a failure: the window picked has no rows. Sized to
// fill a chart body or a card, so a screen never has to choose between a
// misleading flat line at zero and a blank rectangle.
export function NoData({ message = 'No data in this window', hint }) {
  return (
    <div className="flex h-full min-h-[6rem] flex-col items-center justify-center gap-1.5 text-center">
      <Icon name="activity" className="h-5 w-5 text-border-strong" />
      <p className="text-xs font-medium text-ink-subtle">{message}</p>
      {hint && <p className="max-w-xs text-2xs text-ink-faint">{hint}</p>}
    </div>
  )
}

export { ToastViewport } from './Toast'
