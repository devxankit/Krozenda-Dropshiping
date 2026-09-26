import { Icon } from './Icon'

// The icon sits in a soft tile so an empty list reads as a designed state,
// not as a table that failed to render.
export function EmptyState({ icon = 'info', title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 sm:gap-4 rounded-xl border border-dashed border-slate-200/90 bg-slate-50/40 sm:bg-surface px-4 py-6 sm:px-6 sm:py-12 text-center">
      <span className="flex h-9 w-9 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-white shadow-xs text-slate-400 border border-slate-200/60">
        <Icon name={icon} className="h-4.5 w-4.5 sm:h-6 sm:w-6" />
      </span>
      <div className="max-w-sm">
        <p className="text-xs sm:text-base font-bold sm:font-semibold text-slate-900 tracking-tight">{title}</p>
        {description && <p className="mt-0.5 sm:mt-1 text-2xs sm:text-sm leading-normal sm:leading-relaxed text-slate-500">{description}</p>}
      </div>
      {action && <div className="mt-0.5">{action}</div>}
    </div>
  )
}
