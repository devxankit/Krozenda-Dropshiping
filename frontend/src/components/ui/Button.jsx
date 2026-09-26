import { Icon } from './Icon'

const VARIANT_CLASSES = Object.freeze({
  primary:
    'bg-brand-600 text-white shadow-xs hover:bg-brand-700 active:bg-brand-800 focus-visible:ring-brand-500',
  secondary:
    'bg-surface text-slate-900 border border-border shadow-xs hover:border-border-strong hover:bg-surface-muted focus-visible:ring-brand-500',
  ghost: 'bg-transparent text-brand-700 hover:bg-brand-50 focus-visible:ring-brand-500',
  danger: 'bg-danger-500 text-white shadow-xs hover:bg-danger-700 focus-visible:ring-danger-500',
  // Added for the admin panel: a destructive action that is not the primary
  // action on the screen still has to read as destructive without shouting.
  dangerOutline:
    'bg-surface text-danger-700 border border-danger-200 shadow-xs hover:border-danger-500/40 hover:bg-danger-50 focus-visible:ring-danger-500',
  subtle:
    'bg-surface-muted text-ink-muted hover:bg-surface-sunken hover:text-slate-900 focus-visible:ring-brand-500',
  quiet:
    'bg-transparent text-ink-subtle hover:bg-surface-muted hover:text-slate-900 focus-visible:ring-brand-500',
})

// `control` (36px) is the admin density. sm/md/lg keep their existing heights
// so the buyer and vendor screens already using them are unaffected.
const SIZE_CLASSES = Object.freeze({
  xs: 'h-7 px-2.5 text-2xs',
  sm: 'h-8 px-3 text-xs',
  control: 'h-control px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
})

const ICON_ONLY_CLASSES = Object.freeze({
  xs: 'h-7 w-7 p-0',
  sm: 'h-8 w-8 p-0',
  control: 'h-control w-9 p-0',
  md: 'h-10 w-10 p-0',
  lg: 'h-12 w-12 p-0',
})

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  iconOnly = false,
  isLoading = false,
  className = '',
  children,
  disabled,
  ...props
}) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 select-none rounded-md font-medium transition-[color,background-color,border-color,box-shadow,transform] duration-150 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${iconOnly ? ICON_ONLY_CLASSES[size] : SIZE_CLASSES[size]} ${VARIANT_CLASSES[variant]} ${className}`}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      {...props}
    >
      {isLoading ? (
        <Icon name="refresh" className="h-3.5 w-3.5 animate-spin" />
      ) : (
        icon && <Icon name={icon} className="h-3.5 w-3.5" />
      )}
      {!iconOnly && children}
      {iconRight && !isLoading && <Icon name={iconRight} className="h-3.5 w-3.5" />}
    </button>
  )
}
