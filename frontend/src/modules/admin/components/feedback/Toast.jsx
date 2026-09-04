import { createPortal } from 'react-dom'
import { Icon } from '../../../../components/ui'
import { useToastStore } from '../../stores/toastStore'

const TONE = Object.freeze({
  success: 'border-success-200 bg-success-50 text-success-700',
  info: 'border-brand-200 bg-brand-50 text-brand-700',
  warning: 'border-warning-200 bg-warning-50 text-warning-700',
  danger: 'border-danger-200 bg-danger-50 text-danger-700',
})

const TONE_ICON = Object.freeze({
  success: 'successCircle',
  info: 'info',
  warning: 'warning',
  danger: 'danger',
})

// Mounted once, by AdminLayout. Screens never render this themselves — they
// call `toast.success(...)` and this picks it up.
export function ToastViewport() {
  const toasts = useToastStore((state) => state.toasts)
  const dismiss = useToastStore((state) => state.dismiss)

  if (typeof document === 'undefined' || toasts.length === 0) return null

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 right-4 z-toast flex w-full max-w-sm flex-col gap-2"
    >
      {toasts.map((entry) => (
        <div
          key={entry.id}
          className={`pointer-events-auto flex items-start gap-2.5 rounded-lg border px-3.5 py-3 shadow-overlay ${TONE[entry.tone]}`}
        >
          <Icon name={TONE_ICON[entry.tone]} className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{entry.title}</p>
            {entry.description && (
              <p className="mt-0.5 text-xs leading-snug opacity-90">{entry.description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => dismiss(entry.id)}
            aria-label="Dismiss"
            className="shrink-0 rounded p-0.5 opacity-60 transition-opacity hover:opacity-100"
          >
            <Icon name="close" className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>,
    document.body,
  )
}
