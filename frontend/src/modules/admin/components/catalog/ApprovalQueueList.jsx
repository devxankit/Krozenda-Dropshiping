import { Badge, Button, Icon } from '../../../../components/ui'

const KIND_CONFIG = {
  category: {
    icon: 'categories',
    label: 'Category',
    badgeClass: 'bg-accent-50 text-accent-700 border-accent-200/80',
    iconBg: 'bg-accent-100/70 text-accent-700 border-accent-200',
  },
  brand: {
    icon: 'brands',
    label: 'Brand',
    badgeClass: 'bg-brand-50 text-brand-700 border-brand-200/80',
    iconBg: 'bg-brand-100/70 text-brand-700 border-brand-200',
  },
  product: {
    icon: 'products',
    label: 'Product',
    badgeClass: 'bg-success-50 text-success-700 border-success-200/80',
    iconBg: 'bg-success-100/70 text-success-700 border-success-200',
  },
}

export function ApprovalQueueList({
  items = [],
  canApprove,
  onApprove,
  onReject,
  isApproving,
  searchQuery = '',
  onClearSearch,
  tab = 'all',
  onResetTab,
}) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="relative mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-success-500/10 via-teal-500/10 to-brand-500/10 border border-success-200/80 shadow-xs">
          <Icon name="check" className="h-8 w-8 text-success-600" />
          <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-success-500 text-white shadow-xs">
            <Icon name="check" className="h-3 w-3" />
          </span>
        </div>

        <h3 className="text-base font-bold text-slate-900">
          {searchQuery ? 'No matching submissions found' : 'Queue is completely clear!'}
        </h3>

        <p className="mt-1.5 max-w-md text-xs leading-relaxed text-slate-500">
          {searchQuery
            ? `No pending submissions match "${searchQuery}". Try adjusting your keywords or clearing the filter.`
            : 'All seller catalog submissions in this view have been reviewed. When sellers submit new categories, brands, or products, they will appear here.'}
        </p>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
          {searchQuery && (
            <Button size="sm" variant="secondary" onClick={onClearSearch} icon="close">
              Clear search filter
            </Button>
          )}
          {tab !== 'all' && (
            <Button size="sm" variant="secondary" onClick={onResetTab} icon="columns">
              View all submissions
            </Button>
          )}
          {!searchQuery && tab === 'all' && (
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-slate-50 px-3.5 py-1 text-xs font-medium text-slate-600">
              <span className="h-2 w-2 rounded-full bg-success-500 animate-pulse" />
              <span>Moderation system ready</span>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <ul className="divide-y divide-slate-100">
      {items.map((item) => {
        const kindInfo = KIND_CONFIG[item.kind] || KIND_CONFIG.product

        return (
          <li
            key={item.id}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:px-5 sm:py-4 transition-colors hover:bg-slate-50/70"
          >
            {/* Left: Icon and info */}
            <div className="flex items-start gap-3.5 min-w-0 flex-1">
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border shadow-2xs ${kindInfo.iconBg}`}
              >
                <Icon name={kindInfo.icon} className="h-5 w-5" />
              </span>

              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="truncate text-sm font-bold text-slate-900">{item.name}</h4>
                  <span
                    className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold ${kindInfo.badgeClass}`}
                  >
                    {kindInfo.label}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                  {item.context && (
                    <span className="font-medium text-slate-600 truncate max-w-xs sm:max-w-sm">
                      {item.context}
                    </span>
                  )}
                  {item.context && <span className="text-slate-300">·</span>}
                  <span className="inline-flex items-center gap-1 text-slate-500">
                    <Icon name="user" className="h-3 w-3 text-slate-400" />
                    <span>
                      by <strong className="font-semibold text-slate-700">{item.submittedBy}</strong>
                    </span>
                  </span>
                  <span className="text-slate-300">·</span>
                  <span className="inline-flex items-center gap-1 text-slate-500">
                    <Icon name="calendar" className="h-3 w-3 text-slate-400" />
                    <span>{item.submittedAt}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Badges and Action buttons */}
            <div className="flex shrink-0 items-center gap-3 self-end sm:self-center">
              {item.blockedBy ? (
                <Badge tone="danger" size="sm" dot>
                  Blocked by {item.blockedBy.toLowerCase()}
                </Badge>
              ) : (
                <Badge
                  tone={
                    item.waitingDays === 0
                      ? 'success'
                      : item.waitingDays >= 3
                        ? 'warning'
                        : 'neutral'
                  }
                  size="sm"
                >
                  {item.waitingDays === 0
                    ? 'New Today'
                    : `${item.waitingDays}d waiting`}
                </Badge>
              )}

              {canApprove && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="dangerOutline"
                    size="sm"
                    onClick={() => onReject(item)}
                    icon="close"
                  >
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    icon="check"
                    disabled={Boolean(item.blockedBy) || isApproving}
                    onClick={() => onApprove(item)}
                    className="bg-brand-600 hover:bg-brand-700 text-white shadow-xs"
                  >
                    Approve
                  </Button>
                </div>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
