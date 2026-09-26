import { Icon } from '../../../../components/ui'
import { toast } from '../../stores/toastStore'

// Copies a coupon code from the list row without opening the row.
export function CopyCodeButton({ code }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        navigator.clipboard
          ?.writeText(code)
          .then(() => toast.success('Code copied', code))
          .catch(() => toast.error('Could not copy the code'))
      }}
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-ink-faint transition-colors hover:bg-brand-50 hover:text-brand-700"
      title="Copy code"
      aria-label={`Copy ${code}`}
    >
      <Icon name="copy" className="h-3.5 w-3.5" />
    </button>
  )
}
