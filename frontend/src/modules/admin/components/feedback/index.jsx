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
      className={`flex items-start gap-2.5 rounded-lg border px-3.5 py-3 ${ALERT_TONE[tone]} ${className}`}
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
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-danger-200 bg-danger-50/40 p-12 text-center">
      <Icon name="danger" className="h-7 w-7 text-danger-500" />
      <div>
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="mx-auto mt-1 max-w-md text-xs text-ink-subtle">
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

export function PageSkeleton({ rows = 4 }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-6 w-64" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={`tile-${index}`} className="h-24 w-full rounded-lg" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={`row-${index}`} className="h-16 w-full rounded-lg" />
      ))}
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
export { ToastViewport } from './Toast'
