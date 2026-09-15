import { Link } from 'react-router-dom'
import { BUSINESS_MODEL_LABELS } from '../../../../config/constants'
import { ADMIN_ROUTES, adminPath } from '../../../../config/routes'
import { BUSINESS_MODEL_SERIES, ORDER_FLOW_STATUS_LABELS, ORDER_FLOW_STATUS_TONE } from '../../constants'
import { MoneyCell, SectionCard, StatusPill } from '../display'
import { NoData } from '../feedback'
import { SERIES } from '../charts/chartTheme'

// One row per seller within an order: an order carrying items from two
// sellers is two sub-orders, each with its own share of the total. Status
// labels and tones come from ORDER_FLOW_STATUS — the platform's real order
// lifecycle, which is what the API reports.
export function RecentSubOrders({ items = [] }) {
  return (
    <SectionCard
      title="Recent sub-orders"
      description="Newest first, split by seller"
      actions={
        <Link
          to={ADMIN_ROUTES.ORDERS}
          className="text-xs font-medium text-brand-600 hover:text-brand-700"
        >
          View all orders
        </Link>
      }
    >
      {items.length === 0 ? (
        <div className="px-4 py-10">
          <NoData message="No orders yet" hint="Sub-orders appear here as soon as one is placed." />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border-subtle text-left">
                {['Sub-order', 'Seller', 'Model', 'Status', 'Value'].map((heading, index) => (
                  <th
                    key={heading}
                    className={`px-4 py-2 text-2xs font-semibold uppercase tracking-wider text-ink-faint ${index === 4 ? 'text-right' : ''}`}
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((subOrder) => (
                <tr
                  key={subOrder.id}
                  className="border-b border-border-subtle transition-colors last:border-b-0 hover:bg-surface-muted"
                >
                  <td className="px-4 py-2.5">
                    <Link
                      to={adminPath.orderDetail(subOrder.orderId)}
                      className="tabular text-xs font-semibold text-brand-700 hover:text-brand-600"
                    >
                      {subOrder.id}
                    </Link>
                  </td>
                  <td className="max-w-[12rem] truncate px-4 py-2.5 text-xs text-slate-800">
                    {subOrder.seller}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-1.5 whitespace-nowrap text-xs text-ink-subtle">
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: SERIES[BUSINESS_MODEL_SERIES[subOrder.model] - 1] }}
                      />
                      {BUSINESS_MODEL_LABELS[subOrder.model]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusPill
                      status={subOrder.status}
                      labels={ORDER_FLOW_STATUS_LABELS}
                      tones={ORDER_FLOW_STATUS_TONE}
                      size="sm"
                    />
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <MoneyCell amount={subOrder.total} className="text-xs" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  )
}
