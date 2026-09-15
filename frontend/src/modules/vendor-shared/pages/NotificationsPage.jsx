import { Badge, Button } from '../../../components/ui'
import { PageBody, PageHeader } from '../../admin/components/shell'
import { useVendorNotificationsController } from '../controllers/useVendorController'

export function NotificationsPage() {
  const { items, unreadCount, isLoading, markRead, markAllRead } = useVendorNotificationsController()

  return (
    <PageBody>
      <PageHeader
        title="Notifications"
        description="Orders, returns, approvals and platform announcements."
        actions={
          unreadCount > 0 && (
            <Button size="sm" variant="secondary" onClick={() => markAllRead()}>
              Mark all read
            </Button>
          )
        }
      />

      {isLoading && <p className="text-xs text-ink-subtle">Loading notifications…</p>}
      {!isLoading && items.length === 0 && <p className="text-xs text-ink-subtle">No notifications yet.</p>}

      <div className="flex flex-col gap-2">
        {items.map((n) => (
          <button
            key={n.id}
            onClick={() => !n.isRead && markRead(n.id)}
            className={`flex items-start justify-between gap-3 rounded-lg border p-3.5 text-left transition-colors ${
              n.isRead ? 'border-border bg-surface' : 'border-brand-200 bg-brand-50/40'
            }`}
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-900">{n.title}</span>
                {!n.isRead && <Badge tone="brand" size="xs">New</Badge>}
              </div>
              <p className="mt-0.5 text-xs text-ink-subtle">{n.message}</p>
            </div>
            <span className="shrink-0 text-2xs text-ink-faint">{new Date(n.createdAt).toLocaleDateString('en-IN')}</span>
          </button>
        ))}
      </div>
    </PageBody>
  )
}
