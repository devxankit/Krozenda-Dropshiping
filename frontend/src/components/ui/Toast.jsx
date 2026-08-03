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
      className={`flex items-center justify-between gap-4 rounded-md border px-4 py-3 text-sm shadow-sm ${TONE_CLASSES[tone]}`}
    >
      <span>{message}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="opacity-70 hover:opacity-100"
        >
          <Icon name="close" className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
