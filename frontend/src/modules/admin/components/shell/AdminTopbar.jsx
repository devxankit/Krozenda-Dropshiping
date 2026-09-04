import { Avatar, Icon } from '../../../../components/ui'
import { ProfileMenu } from './ProfileMenu'

export function AdminTopbar({
  user,
  unreadCount = 0,
  onOpenSearch,
  onOpenNotifications,
  onOpenMobileNav,
  onSignOut,
}) {
  return (
    <header className="flex h-topbar shrink-0 items-center gap-3 border-b border-border bg-surface px-4">
      <button
        type="button"
        onClick={onOpenMobileNav}
        aria-label="Open navigation"
        className="-ml-1 rounded-md p-2 text-ink-subtle transition-colors hover:bg-surface-muted lg:hidden"
      >
        <Icon name="menu" className="h-5 w-5" />
      </button>

      <button
        type="button"
        onClick={onOpenSearch}
        className="flex h-8 w-full max-w-80 items-center gap-2 rounded-md border border-border bg-surface-muted px-2.5 text-left text-xs text-ink-faint transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        <Icon name="search" className="h-3.5 w-3.5" />
        <span className="truncate">Search orders, products, sellers…</span>
        <kbd className="ml-auto hidden rounded border border-border bg-surface px-1.5 text-2xs font-medium text-ink-subtle sm:block">
          ⌘K
        </kbd>
      </button>

      <div className="flex-1" />

      <button
        type="button"
        onClick={onOpenNotifications}
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        className="relative rounded-md p-2 text-ink-subtle transition-colors hover:bg-surface-muted hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        <Icon name="notifications" className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full border-2 border-surface bg-danger-500" />
        )}
      </button>

      <div className="h-6 w-px bg-border" />

      <ProfileMenu user={user} onSignOut={onSignOut}>
        <Avatar name={user?.name} size="sm" tone="inverted" />
        <span className="hidden leading-tight sm:block">
          <span className="block text-xs font-semibold text-slate-900">{user?.name}</span>
          <span className="block text-2xs text-ink-subtle">{user?.roleLabel}</span>
        </span>
        <Icon name="chevronDown" className="h-3.5 w-3.5 text-ink-faint" />
      </ProfileMenu>
    </header>
  )
}
