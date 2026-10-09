// Table columns for the Customers, Coupons, Returns and KYC document screens (copied from the web's
// vendorColumns.jsx; only the sets these screens use).
import { Linking, View } from 'react-native'
import { Badge, Text } from '../../../components/ui'
import { VENDOR_COUPON_STATUS_TONE, VENDOR_RETURN_STATUS_TONE } from '../constants'
import { DateCell, MoneyCell, StatusPill } from '../../../components/admin/display/cells'
import { colors } from '../../../theme'

const tabular = { fontVariant: ['tabular-nums'] }

export const VENDOR_CUSTOMER_COLUMNS = Object.freeze([
  {
    key: 'name',
    header: 'Customer',
    render: (row) => (
      <View style={{ minWidth: 0 }}>
        <Text style={{ fontSize: 12, lineHeight: 16, fontWeight: '500', color: colors.slate[900] }}>{row.name}</Text>
        <Text noTranslate style={{ fontSize: 12, lineHeight: 16, color: colors.ink.subtle }}>
          {row.mobileNumber || row.email}
        </Text>
      </View>
    ),
  },
  {
    key: 'ordersCount',
    header: 'Orders',
    width: '6rem',
    align: 'right',
    render: (row) => (
      <Text noTranslate style={[{ fontSize: 12 }, tabular]}>
        {row.ordersCount}
      </Text>
    ),
  },
  { key: 'totalSpent', header: 'Spent (with you)', width: '9rem', align: 'right', render: (row) => <MoneyCell amount={row.totalSpent} compact /> },
  { key: 'lastOrderAt', header: 'Last Order', width: '8rem', render: (row) => <DateCell value={row.lastOrderAt} withTime={false} /> },
])

export const VENDOR_COUPON_COLUMNS = Object.freeze([
  {
    key: 'code',
    header: 'Coupon',
    render: (row) => (
      <View style={{ minWidth: 0 }}>
        <Text noTranslate style={{ fontFamily: 'monospace', fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.brand[700] }}>
          {row.code}
        </Text>
        <Text style={{ fontSize: 11, lineHeight: 16, color: colors.ink.subtle }}>{row.description || 'No description'}</Text>
      </View>
    ),
  },
  {
    key: 'discountValue',
    header: 'Discount',
    width: '8rem',
    render: (row) => (
      <Text style={{ fontSize: 12, lineHeight: 16, fontWeight: '500', color: colors.slate[900] }}>
        {row.discountType === 'PERCENTAGE' ? `${row.discountValue}%` : row.discountType === 'FIXED' ? `₹${row.discountValue}` : 'Free shipping'}
      </Text>
    ),
  },
  {
    key: 'usedCount',
    header: 'Used',
    width: '6rem',
    align: 'right',
    render: (row) => (
      <Text noTranslate style={[{ fontSize: 12 }, tabular]}>
        {row.usedCount}
        {row.usageLimit ? ` / ${row.usageLimit}` : ''}
      </Text>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    width: '8rem',
    render: (row) => (
      <Badge tone={VENDOR_COUPON_STATUS_TONE[row.status] || 'neutral'} size="sm">
        {row.status}
      </Badge>
    ),
  },
])

export const VENDOR_COUPON_TABS = Object.freeze([
  { id: 'all', label: 'All coupons' },
  { id: 'active', label: 'Active' },
  { id: 'upcoming', label: 'Scheduled' },
  { id: 'inactive', label: 'Paused' },
  { id: 'expired', label: 'Expired' },
  { id: 'usage_limit_reached', label: 'Exhausted' },
])

export const VENDOR_RETURN_COLUMNS = Object.freeze([
  {
    key: 'productName',
    header: 'Product',
    render: (row) => (
      <View style={{ minWidth: 0 }}>
        <Text style={{ fontSize: 12, lineHeight: 16, fontWeight: '500', color: colors.slate[900] }}>{row.productName}</Text>
        <Text style={{ fontSize: 12, lineHeight: 16, color: colors.ink.subtle }}>
          {row.customer.name} · {row.requestType}
        </Text>
      </View>
    ),
  },
  {
    key: 'reason',
    header: 'Reason',
    render: (row) => (
      <Text numberOfLines={2} style={{ fontSize: 12, lineHeight: 16, color: colors.ink.muted }}>
        {row.reason}
      </Text>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    width: '8rem',
    render: (row) => <StatusPill status={row.status} tones={VENDOR_RETURN_STATUS_TONE} size="sm" />,
  },
  {
    // The seller's own advisory input. Shown as a column so a queue can be
    // scanned for the ones still waiting on them.
    key: 'sellerRecommendation',
    header: 'Your response',
    width: '9rem',
    render: (row) => {
      if (row.sellerRecommendation) {
        return (
          <Badge tone={row.sellerRecommendation.decision === 'APPROVE' ? 'success' : 'danger'} size="sm">
            {row.sellerRecommendation.decision === 'APPROVE' ? 'Approve' : 'Reject'}
          </Badge>
        )
      }
      if (row.status !== 'PENDING') return <Text style={{ fontSize: 11, lineHeight: 16, color: colors.ink.faint }}>—</Text>
      return <Text style={{ fontSize: 11, lineHeight: 16, fontWeight: '500', color: colors.brand[700] }}>Respond</Text>
    },
  },
  { key: 'createdAt', header: 'Requested', width: '8rem', render: (row) => <DateCell value={row.createdAt} withTime={false} /> },
])

export const VENDOR_KYC_DOC_COLUMNS = Object.freeze([
  {
    key: 'documentType',
    header: 'Document Type',
    render: (row) => (
      <View style={{ minWidth: 0 }}>
        <Text style={{ fontSize: 12, lineHeight: 16, fontWeight: '500', color: colors.slate[900] }}>{row.documentLabel || row.documentType}</Text>
        {row.documentNumber ? (
          <Text noTranslate style={{ fontSize: 11, lineHeight: 16, color: colors.ink.subtle }}>
            {row.documentNumber}
          </Text>
        ) : null}
      </View>
    ),
  },
  {
    key: 'documentUrl',
    header: 'File',
    width: '7rem',
    render: (row) =>
      row.documentUrl ? (
        <Text
          onPress={() => Linking.openURL(row.documentUrl).catch(() => {})}
          style={{ fontSize: 11, lineHeight: 16, fontWeight: '600', color: colors.brand[700] }}
        >
          View
        </Text>
      ) : (
        <Text style={{ fontSize: 11, lineHeight: 16, color: colors.ink.faint }}>—</Text>
      ),
  },
  {
    key: 'status',
    header: 'Review State',
    width: '8.5rem',
    render: (row) => (
      <Badge tone={row.status === 'APPROVED' ? 'success' : row.status === 'REJECTED' ? 'danger' : 'warning'} size="sm">
        {row.status}
      </Badge>
    ),
  },
  {
    key: 'createdAt',
    header: 'Uploaded',
    width: '8.5rem',
    render: (row) => (
      <Text noTranslate style={{ fontSize: 12, lineHeight: 16, color: colors.ink.muted }}>
        {new Date(row.createdAt).toLocaleDateString('en-IN')}
      </Text>
    ),
  },
])
