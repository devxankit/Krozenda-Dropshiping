import { View } from 'react-native'
import { Badge, Text } from '../../../components/ui'
import { DateCell, MoneyCell, PrimaryCell } from '../../../components/admin/display'
import { colors } from '../../../theme'

// Earnings & Settlements + Revenue columns (copied from the web's SettlementsPage.jsx and
// admin/tableColumns/analyticsColumns.jsx PRODUCT_REVENUE_COLUMNS).

// What a row is waiting on. The three states are genuinely different things.
export const EARNING_STATE = Object.freeze({
  PAID: { tone: 'success', label: 'Paid' },
  IN_BATCH: { tone: 'brand', label: 'In settlement' },
  UNSETTLED: { tone: 'warning', label: 'Awaiting settlement' },
})

export const PAYOUT_TONE = Object.freeze({
  COMPLETED: 'success',
  PROCESSING: 'brand',
  PENDING: 'warning',
  FAILED: 'danger',
  CANCELLED: 'neutral',
})

export const EARNING_COLUMNS = [
  {
    key: 'productName',
    header: 'Product',
    render: (row) => (
      <View>
        <Text noTranslate style={{ fontSize: 12, lineHeight: 16, fontWeight: '500', color: colors.slate[900] }}>
          {row.productName} × {row.quantity}
        </Text>
        {row.settlementId ? (
          <Text noTranslate style={{ fontSize: 11, lineHeight: 16, color: colors.ink.subtle }}>
            {row.settlementId}
          </Text>
        ) : null}
      </View>
    ),
  },
  {
    key: 'state',
    header: 'Status',
    width: '10rem',
    render: (row) => (
      <Badge tone={EARNING_STATE[row.state].tone} size="sm">
        {EARNING_STATE[row.state].label}
      </Badge>
    ),
  },
  { key: 'grossAmount', header: 'Gross', width: '8rem', align: 'right', render: (row) => <MoneyCell amount={row.grossAmount} compact /> },
  {
    key: 'commission',
    header: 'Commission',
    width: '8rem',
    align: 'right',
    render: (row) => (
      <View style={{ alignItems: 'flex-end' }}>
        <MoneyCell amount={row.commission} compact muted />
        {row.estimated ? <Text style={{ fontSize: 11, lineHeight: 16, color: colors.ink.faint }}>estimate</Text> : null}
      </View>
    ),
  },
  {
    key: 'netAmount',
    header: 'Net Earning',
    width: '8.5rem',
    align: 'right',
    render: (row) => <MoneyCell amount={row.netAmount} compact className="text-success-600" />,
  },
  { key: 'deliveredAt', header: 'Delivered', width: '8rem', render: (row) => <DateCell value={row.deliveredAt} withTime={false} /> },
]

export const PAYOUT_COLUMNS = [
  {
    key: 'payoutId',
    header: 'Payout',
    render: (row) => (
      <View>
        <Text noTranslate style={{ fontSize: 12, lineHeight: 16, fontWeight: '500', color: colors.slate[900] }}>
          {row.payoutId}
        </Text>
        <Text noTranslate style={{ fontSize: 11, lineHeight: 16, color: colors.ink.subtle }}>
          {row.bankName ? `${row.bankName} · ` : ''}
          {row.bankAccountMasked || 'No bank on record'}
          {row.attempt > 1 ? ` · attempt ${row.attempt}` : ''}
        </Text>
      </View>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    width: '9rem',
    render: (row) => (
      <View style={{ gap: 2 }}>
        <Badge tone={PAYOUT_TONE[row.status] || 'neutral'} size="sm">
          {row.status}
        </Badge>
        {/* A seller is entitled to know why a transfer to them failed. */}
        {row.status === 'FAILED' && row.failureReason ? (
          <Text noTranslate style={{ fontSize: 11, lineHeight: 16, color: colors.danger[600] }}>
            {row.failureReason}
          </Text>
        ) : null}
      </View>
    ),
  },
  { key: 'amount', header: 'Amount', width: '9rem', align: 'right', render: (row) => <MoneyCell amount={row.amount} /> },
  {
    key: 'utr',
    header: 'UTR',
    width: '10rem',
    render: (row) => (
      <Text noTranslate style={{ fontSize: 12, lineHeight: 16, color: colors.ink.muted }}>
        {row.utr || '—'}
      </Text>
    ),
  },
  { key: 'processedAt', header: 'Processed', width: '9rem', render: (row) => <DateCell value={row.processedAt || row.createdAt} /> },
]

export const PRODUCT_REVENUE_COLUMNS = Object.freeze([
  { key: 'name', header: 'Product', render: (product) => <PrimaryCell title={product.name} /> },
  {
    key: 'units',
    header: 'Units',
    width: '5rem',
    align: 'right',
    render: (product) => (
      <Text noTranslate style={{ fontVariant: ['tabular-nums'] }}>
        {product.units}
      </Text>
    ),
  },
  {
    key: 'netSales',
    header: 'Net sales',
    width: '8rem',
    align: 'right',
    render: (product) => <MoneyCell amount={product.netSales} compact />,
  },
  {
    key: 'sellerEarnings',
    header: 'Earned',
    width: '8rem',
    align: 'right',
    render: (product) => <MoneyCell amount={product.sellerEarnings} compact />,
  },
])
