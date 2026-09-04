const TONE_CLASSES = Object.freeze({
  neutral: 'bg-surface-muted text-slate-700',
  brand: 'bg-brand-50 text-brand-700',
  accent: 'bg-accent-50 text-accent-700',
  success: 'bg-success-50 text-success-700',
  warning: 'bg-warning-50 text-warning-700',
  danger: 'bg-danger-50 text-danger-700',
})

// The dot colour is a step darker than the wash so it stays visible against
// its own background — status must read at a glance in a dense table.
const DOT_CLASSES = Object.freeze({
  neutral: 'bg-ink-faint',
  brand: 'bg-brand-600',
  accent: 'bg-accent-600',
  success: 'bg-success-500',
  warning: 'bg-warning-500',
  danger: 'bg-danger-500',
})

const SIZE_CLASSES = Object.freeze({
  sm: 'h-5 px-2 text-2xs',
  md: 'px-2.5 py-0.5 text-xs',
})

export function Badge({ tone = 'neutral', size = 'md', dot = false, children, className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-medium ${SIZE_CLASSES[size]} ${TONE_CLASSES[tone]} ${className}`}
    >
      {dot && <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT_CLASSES[tone]}`} />}
      {children}
    </span>
  )
}
