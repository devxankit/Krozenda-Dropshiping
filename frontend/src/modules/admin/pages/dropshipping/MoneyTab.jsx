import { Badge, Card, CardBody } from '../../../../components/ui'
import { InlineAlert } from '../../components/feedback'

// Admin > Dropshipping > Money.
//
// Two questions, kept apart on purpose: what each dropshipping platform was
// sent and what Krozenda made on it, and separately, where money is currently
// somewhere it should not be. Netting the second into the first would hide it.

const money = (n) =>
  n === null || n === undefined || !Number.isFinite(Number(n))
    ? '—'
    : `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

const EXCEPTION_TONE = {
  notReachedSupplier: 'danger',
  paymentNotSettled: 'danger',
  stuckInCancelWindow: 'warning',
  cancelledAfterSending: 'warning',
}

const EXCEPTION_TITLE = {
  notReachedSupplier: 'Paid, but no supplier has it',
  paymentNotSettled: 'Payment never settled',
  stuckInCancelWindow: 'Stuck waiting to be sent',
  cancelledAfterSending: 'Cancelled after the supplier had it',
}

// ---------------------------------------------------------------------------
function SupplierTable({ suppliers, totals }) {
  if (suppliers.length === 0) {
    return (
      <div className="py-10 text-center text-slate-500">
        No orders have gone to a supplier yet. Earnings appear here once the first one is sent.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="py-2 pr-4 font-medium">Platform</th>
            <th className="py-2 pr-4 text-right font-medium">Orders</th>
            <th className="py-2 pr-4 text-right font-medium">Customer paid</th>
            <th className="py-2 pr-4 text-right font-medium">Supplier cost</th>
            <th className="py-2 pr-4 text-right font-medium">Your margin</th>
            <th className="py-2 pr-4 text-right font-medium">Waiting</th>
            <th className="py-2 text-right font-medium">At risk</th>
          </tr>
        </thead>
        <tbody>
          {suppliers.map((s) => (
            <tr key={s.supplier} className="border-b border-slate-100">
              <td className="py-2.5 pr-4">
                <span className="font-medium text-slate-800">{s.label}</span>
                {s.supplier === 'UNKNOWN' && (
                  <Badge tone="warning" className="ml-2">
                    unidentified
                  </Badge>
                )}
              </td>
              <td className="py-2.5 pr-4 text-right text-slate-700">{s.orders}</td>
              <td className="py-2.5 pr-4 text-right text-slate-800">{money(s.revenue)}</td>
              <td className="py-2.5 pr-4 text-right text-slate-700">
                {s.costKnown ? (
                  money(s.cost)
                ) : (
                  <span className="text-amber-600" title={`${s.linesWithoutCost} line(s) have no cost from this supplier`}>
                    not provided
                  </span>
                )}
              </td>
              <td className="py-2.5 pr-4 text-right">
                {s.margin === null ? (
                  // Showing a margin computed from a missing cost would read
                  // as fact and be acted on.
                  <span className="text-slate-400">cannot tell</span>
                ) : (
                  <span className="font-medium text-emerald-700">
                    {money(s.margin)} <span className="text-xs text-slate-500">({s.marginPercent}%)</span>
                  </span>
                )}
              </td>
              <td className="py-2.5 pr-4 text-right text-slate-500">
                {s.pending ? `${s.pending} · ${money(s.pendingValue)}` : '—'}
              </td>
              <td className="py-2.5 text-right">
                {s.atRisk ? (
                  <span className="font-medium text-rose-600">
                    {s.atRisk} · {money(s.atRiskValue)}
                  </span>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </td>
            </tr>
          ))}
          {totals && (
            <tr className="font-medium text-slate-800">
              <td className="py-2.5 pr-4">Total</td>
              <td className="py-2.5 pr-4 text-right">{totals.orders}</td>
              <td className="py-2.5 pr-4 text-right">{money(totals.revenue)}</td>
              <td className="py-2.5 pr-4 text-right">{totals.costKnown ? money(totals.cost) : '—'}</td>
              <td className="py-2.5 pr-4 text-right">
                {totals.margin === null ? <span className="text-slate-400">cannot tell</span> : money(totals.margin)}
              </td>
              <td className="py-2.5 pr-4 text-right text-slate-500">
                {totals.pending ? money(totals.pendingValue) : '—'}
              </td>
              <td className="py-2.5 text-right text-rose-600">{totals.atRisk ? money(totals.atRiskValue) : '—'}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
export function MoneyTab({ controller }) {
  const { suppliers, totals, exceptions, exceptionCount, isLoading } = controller
  const costMissing = suppliers.some((s) => !s.costKnown)

  if (isLoading) return <div className="py-12 text-center text-slate-500">Loading…</div>

  return (
    <div className="space-y-4">
      {exceptionCount > 0 && (
        <InlineAlert tone="danger" title={`${exceptionCount} payment issue(s) need attention`}>
          Each one below is money sitting somewhere it should not be.
        </InlineAlert>
      )}

      <Card>
        <CardBody className="space-y-3">
          <div>
            <h3 className="font-medium text-slate-800">Earnings by dropshipping platform</h3>
            <p className="mt-1 text-sm text-slate-600">
              What customers paid for each platform&rsquo;s items, what that platform charges you, and what is left. Only
              orders the supplier actually received are counted.
            </p>
          </div>
          <SupplierTable suppliers={suppliers} totals={totals} />
          {costMissing && (
            <p className="text-xs text-amber-700">
              Some platforms do not publish a cost price to Shopify, so margin cannot be calculated for them. Add cost
              prices in Shopify to see it.
            </p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-3">
          <div>
            <h3 className="font-medium text-slate-800">Payment issues</h3>
            <p className="mt-1 text-sm text-slate-600">
              Kept separate from earnings on purpose — these are open obligations, not losses.
            </p>
          </div>

          {!exceptions ? (
            <div className="py-6 text-center text-slate-500">Loading…</div>
          ) : exceptionCount === 0 ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              Nothing outstanding. Every paid order has reached a supplier, and no payment is unaccounted for.
            </div>
          ) : (
            <div className="space-y-2">
              {Object.entries(exceptions)
                .filter(([key, group]) => key !== 'total' && group?.count > 0)
                .map(([key, group]) => (
                  <div key={key} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge tone={EXCEPTION_TONE[key] || 'neutral'}>{group.count}</Badge>
                        <span className="font-medium text-slate-800">{EXCEPTION_TITLE[key] || key}</span>
                      </div>
                      {group.value ? <span className="text-sm text-slate-700">{money(group.value)}</span> : null}
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{group.meaning}</p>
                    {(group.rows || []).slice(0, 5).map((r, i) => (
                      <p key={i} className="mt-1 font-mono text-xs text-slate-500">
                        ORD-{String(r.order || r._id).slice(-8).toUpperCase()}
                        {r.supplierLabel ? ` · ${r.supplierLabel}` : ''}
                        {r.lastError ? ` · ${String(r.lastError).slice(0, 70)}` : ''}
                      </p>
                    ))}
                  </div>
                ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  )
}

export default MoneyTab
