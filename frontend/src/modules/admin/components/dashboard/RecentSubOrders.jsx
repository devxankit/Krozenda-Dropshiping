import { Link } from 'react-router-dom'
import { Badge } from '../../../../components/ui'
import { BUSINESS_MODEL_LABELS, ORDER_STATUS_LABELS } from '../../../../config/constants'
import { adminPath } from '../../../../config/routes'
import { BUSINESS_MODEL_SERIES, ORDER_STATUS_TONE } from '../../constants'
import { MoneyCell, SectionCard } from '../display'
import { SERIES } from '../charts/chartTheme'

export function RecentSubOrders({ items = [] }) {
  return (
    <SectionCard
      title="Recent sub-orders"
      actions={
        <Link
          to={adminPath.orderDetail('KZ-40128')}
          className="text-xs font-medium text-brand-600 hover:text-brand-700"
        >
          View all orders
        </Link>
      }
    >
      <table className="w-full border-collapse text-sm">
        <tbody>
          {items.map((subOrder) => (
            <tr key={subOrder.id} className="border-b border-border-subtle last:border-b-0">
              <td className="px-4 py-2.5">
                <Link
                  to={adminPath.orderDetail(subOrder.orderId)}
                  className="tabular text-xs font-semibold text-brand-700 hover:text-brand-600"
                >
                  {subOrder.id}
                </Link>
              </td>
              <td className="px-4 py-2.5 text-xs text-slate-800">{subOrder.seller}</td>
              <td className="px-4 py-2.5">
                <span className="flex items-center gap-1.5 text-xs text-ink-subtle">
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: SERIES[BUSINESS_MODEL_SERIES[subOrder.model] - 1] }}
                  />
                  {BUSINESS_MODEL_LABELS[subOrder.model]}
                </span>
              </td>
              <td className="px-4 py-2.5">
                <Badge tone={ORDER_STATUS_TONE[subOrder.status] || 'neutral'} size="sm" dot>
                  {ORDER_STATUS_LABELS[subOrder.status] || subOrder.status}
                </Badge>
              </td>
              <td className="px-4 py-2.5 text-right">
                <MoneyCell amount={subOrder.total} className="text-xs" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </SectionCard>
  )
}
