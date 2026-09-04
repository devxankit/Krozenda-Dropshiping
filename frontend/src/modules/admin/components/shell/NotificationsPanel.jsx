import { Link } from 'react-router-dom'
import { Button, EmptyState, Icon } from '../../../../components/ui'
import { Drawer } from '../overlay/Drawer'

const TONE_STYLES = Object.freeze({
  danger: { wrap: 'bg-danger-50 text-danger-700', icon: 'danger' },
  warning: { wrap: 'bg-warning-50 text-warning-700', icon: 'warning' },
  success: { wrap: 'bg-success-50 text-success-700', icon: 'successCircle' },
  brand: { wrap: 'bg-brand-50 text-brand-700', icon: 'info' },
})

// items: [{ id, tone, title, body, at, to, read }]
export function NotificationsPanel({ isOpen, onClose, items = [], onMarkAllRead }) {
  const unread = items.filter((item) => !item.read).length

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Notifications"
      description={unread > 0 ? `${unread} unread` : 'You are all caught up'}
      width="sm"
      footer={
        items.length > 0 && (
          <Button variant="secondary" size="control" onClick={onMarkAllRead} disabled={unread === 0}>
            Mark all as read
          </Button>
        )
      }
    >
      {items.length === 0 ? (
        <div className="p-6">
          <EmptyState
            icon="notifications"
            title="Nothing to report"
            description="Alerts about payouts, KYC submissions and failed integrations land here."
          />
        </div>
      ) : (
        <ul className="divide-y divide-border-subtle">
          {items.map((item) => {
            const tone = TONE_STYLES[item.tone] || TONE_STYLES.brand
            return (
              <li key={item.id}>
                <Link
                  to={item.to}
                  onClick={onClose}
                  className={`flex gap-3 px-5 py-3.5 transition-colors hover:bg-surface-muted ${item.read ? '' : 'bg-brand-50/30'}`}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${tone.wrap}`}
                  >
                    <Icon name={tone.icon} className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-slate-900">{item.title}</span>
                    <span className="mt-0.5 block text-xs leading-snug text-ink-subtle">
                      {item.body}
                    </span>
                    <span className="mt-1 block text-2xs text-ink-faint">{item.at}</span>
                  </span>
                  {!item.read && (
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-600" />
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </Drawer>
  )
}
