import { Icon } from '../ui/Icon'

export function Topbar({ title, actions, onMenuClick }) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-surface px-4">
      <div className="flex items-center gap-3">
        {onMenuClick && (
          <button
            type="button"
            onClick={onMenuClick}
            aria-label="Open menu"
            className="rounded-md p-2 text-slate-500 hover:bg-surface-muted lg:hidden"
          >
            <Icon name="menu" />
          </button>
        )}
        {title && <h1 className="text-lg font-semibold text-slate-900">{title}</h1>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  )
}
