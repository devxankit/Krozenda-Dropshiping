import { Icon } from './Icon'

const TONE_CLASSES = Object.freeze({
  info: 'border-brand-200 bg-brand-50 text-brand-700',
  success: 'border-success-500/30 bg-success-50 text-success-700',
  warning: 'border-warning-500/30 bg-warning-50 text-warning-700',
  danger: 'border-danger-500/30 bg-danger-50 text-danger-700',
})

export function Toast({ tone = 'info', message, onDismiss }) {
  return (
    <div
      role="status"
      className={`flex items-center justify-between gap-4 animate-rise-in rounded-lg border px-4 py-3 text-sm shadow-raised ${TONE_CLASSES[tone]}`}
    >
      <span>{message}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="rounded-md p-0.5 opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
        >
          <Icon name="close" className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
