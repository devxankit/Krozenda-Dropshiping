// The surface everything on an admin screen sits on. Header and footer are
// optional so the same component covers a bare panel, a titled section, and
// a table container — three variants of one object rather than three
// lookalike divs drifting apart.

export function Card({ children, className = '', ...props }) {
  return (
    <div className={`rounded-xl border border-slate-200/80 bg-surface shadow-xs ${className}`} {...props}>
      {children}
    </div>
  )
}

export function CardHeader({ title, description, actions, className = '' }) {
  return (
    <div
      className={`flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5 border-b border-border px-3.5 py-2.5 sm:px-4 sm:py-3.5 ${className}`}
    >
      <div className="min-w-0">
        {title && <h2 className="text-xs sm:text-sm font-semibold text-slate-900">{title}</h2>}
        {description && <p className="mt-0.5 text-2xs sm:text-xs leading-snug text-ink-subtle">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">{actions}</div>}
    </div>
  )
}

export function CardBody({ children, className = '' }) {
  return <div className={`p-3 sm:p-4 ${className}`}>{children}</div>
}

export function CardFooter({ children, className = '' }) {
  return (
    <div className={`flex items-center justify-between gap-3 border-t border-border px-3.5 py-2.5 sm:px-4 sm:py-3 ${className}`}>
      {children}
    </div>
  )
}
