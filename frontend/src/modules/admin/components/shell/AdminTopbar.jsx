import { Avatar, Icon } from '../../../../components/ui'
import { ProfileMenu } from './ProfileMenu'
import { LanguageSwitcher } from '../../../../components/common/LanguageSwitcher'

export function AdminTopbar({
  user,
  unreadCount = 0,
  onOpenSearch,
  onOpenNotifications,
  onOpenMobileNav,
  onSignOut,
}) {
  return (
    <header className="flex h-topbar shrink-0 items-center gap-2 border-b border-border bg-surface px-3 sm:gap-3 sm:px-5">
      <button
        type="button"
        onClick={onOpenMobileNav}
        aria-label="Open navigation"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-ink-subtle transition-colors hover:bg-surface-muted hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 lg:hidden"
      >
        <Icon name="menu" className="h-5 w-5" />
      </button>

      <button
        type="button"
        onClick={onOpenSearch}
        aria-label="Search orders, products, sellers"
        className="flex h-9 w-9 shrink-0 items-center justify-center gap-2 rounded-md text-ink-subtle transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 sm:w-full sm:max-w-80 sm:justify-start sm:border sm:border-border sm:bg-surface-muted sm:px-3 sm:text-left sm:text-xs sm:text-ink-faint sm:hover:border-border-strong sm:hover:bg-surface"
      >
        <Icon name="search" className="h-4 w-4 shrink-0 sm:h-3.5 sm:w-3.5" />
        <span className="hidden truncate sm:inline">Search orders, products, sellers…</span>
        <kbd className="ml-auto hidden rounded border border-border bg-surface px-1.5 text-2xs font-medium text-ink-subtle sm:block">
          ⌘K
        </kbd>
      </button>

      <div className="flex-1" />

      <LanguageSwitcher variant="compact" tone="panel" />

      <button
        type="button"
        onClick={onOpenNotifications}
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-ink-subtle transition-colors hover:bg-surface-muted hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        <Icon name="notifications" className="h-[1.125rem] w-[1.125rem]" />
        {unreadCount > 0 && (
          <span className="tabular absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-surface bg-danger-500 px-1 text-[0.5625rem] font-bold leading-none text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <div className="hidden h-6 w-px bg-border sm:block" />

      <ProfileMenu user={user} onSignOut={onSignOut}>
        <Avatar name={user?.name} size="sm" tone="inverted" />
        <span className="hidden leading-tight sm:block">
          <span className="block max-w-[9rem] truncate text-xs font-semibold text-slate-900">
            {user?.name}
          </span>
          <span className="block text-2xs text-ink-subtle">{user?.roleLabel}</span>
        </span>
        <Icon name="chevronDown" className="hidden h-3.5 w-3.5 text-ink-faint sm:block" />
      </ProfileMenu>
    </header>
  )
}
