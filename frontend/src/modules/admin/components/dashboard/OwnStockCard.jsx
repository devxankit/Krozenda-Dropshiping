import { useState } from 'react'
import { Icon, Switch } from '../../../../components/ui'
import { ConfirmDialog } from '../overlay/ConfirmDialog'

// The platform-wide "Own stock" switch, on the dashboard. Turning it on is
// harmless and applies at once; turning it off pulls every admin product off
// the storefront, so it asks first. The sidebar only reflects the state
// (greys the own-stock modules) — this card is where it is changed.
export function OwnStockCard({ enabled, isSaving = false, onChange }) {
  const [confirmOff, setConfirmOff] = useState(false)

  function handleToggle(on) {
    if (on) onChange(true)
    else setConfirmOff(true)
  }

  return (
    <>
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface px-4 py-3 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${
              enabled ? 'bg-brand-50 text-brand-600' : 'bg-surface-sunken text-ink-faint'
            }`}
          >
            <Icon name="inventory" className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900">
              Own stock
              <span
                className={`rounded-full px-1.5 py-0.5 text-2xs font-semibold ${
                  enabled ? 'bg-success-50 text-success-700' : 'bg-warning-50 text-warning-700'
                }`}
              >
                {enabled ? 'On' : 'Off'}
              </span>
            </p>
            <p className="text-xs text-ink-muted">
              {enabled
                ? 'Admin products are on sale, and admin can add products, categories and brands.'
                : 'Admin products are hidden from buyers and adding them is blocked. Only seller and dropshipping products are on sale.'}
            </p>
          </div>
        </div>

        <Switch
          id="dashboard-own-stock-toggle"
          checked={enabled}
          disabled={isSaving}
          onChange={(event) => handleToggle(event.target.checked)}
          label={enabled ? 'On' : 'Off'}
          className="shrink-0 self-end sm:self-center"
        />
      </div>

      <ConfirmDialog
        isOpen={confirmOff}
        onClose={() => setConfirmOff(false)}
        onConfirm={() => onChange(false, { onSuccess: () => setConfirmOff(false) })}
        title="Turn off own stock?"
        description="Buyers will only see seller and dropshipping products."
        confirmLabel="Turn off"
        isSubmitting={isSaving}
      >
        <ul className="list-disc space-y-1 pl-4 text-sm text-ink-muted">
          <li>All of admin&rsquo;s own products disappear from the storefront, and any already in a buyer&rsquo;s cart can&rsquo;t be checked out.</li>
          <li>Adding new products, categories and brands from admin is blocked.</li>
          <li>Nothing is deleted — switch it back on and everything returns as it was.</li>
        </ul>
      </ConfirmDialog>
    </>
  )
}
