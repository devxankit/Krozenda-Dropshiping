import { View } from 'react-native'
import { Badge, Text } from '../../../components/ui'
import { DateCell, IdCell, MoneyCell, StatusPill } from '../../../components/admin/display/cells'
import { VENDOR_ORDER_STATUS_TONE } from '../constants'
import { formatCarrierRupees, shipmentStatusPresentation } from '../../../lib/shipping/presentation'
import { colors, fontFamilyFor } from '../../../theme'

// Columns for Orders (copied from web tableColumns/vendorColumns.jsx) and for the
// seller shipment list (web tableColumns/shipmentColumns.jsx, seller variant only).

export const VENDOR_ORDER_COLUMNS = Object.freeze([
  {
    key: 'id',
    header: 'Order ID',
    width: '8.5rem',
    render: (row) => <IdCell id={row.id.slice(-8).toUpperCase()} />,
  },
  {
    key: 'items',
    header: 'Items',
    render: (row) => (
      <View>
        <Text style={{ fontSize: 12, lineHeight: 16, fontWeight: '500', color: colors.slate[900] }}>
          {row.items[0]?.name}
          {row.items.length > 1 ? ` +${row.items.length - 1} more` : ''}
        </Text>
        <Text style={{ fontSize: 12, lineHeight: 16, color: colors.ink.subtle }}>Buyer: {row.customer.name}</Text>
      </View>
    ),
  },
  {
    key: 'itemsValue',
    header: 'Order Value',
    width: '7.5rem',
    align: 'right',
    render: (row) => <MoneyCell amount={row.itemsValue} compact />,
  },
  {
    key: 'status',
    header: 'Status',
    width: '9rem',
    render: (row) => <StatusPill status={row.status} tones={VENDOR_ORDER_STATUS_TONE} size="sm" />,
  },
  {
    key: 'createdAt',
    header: 'Placed',
    width: '8rem',
    render: (row) => <DateCell value={row.createdAt} />,
  },
])

export const VENDOR_ORDER_TABS = Object.freeze([
  { id: 'all', label: 'All Orders' },
  { id: 'pending', label: 'New' },
  { id: 'processing', label: 'Processing' },
  { id: 'shipped', label: 'Shipped' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'cancelled', label: 'Cancelled' },
])

const mono = { fontFamily: fontFamilyFor('400'), fontVariant: ['tabular-nums'] }

function renderStatus(row) {
  const presentation = shipmentStatusPresentation(row.status)
  return (
    <View style={{ gap: 4, alignItems: 'flex-start' }}>
      <Badge tone={presentation.tone} size="sm" dot>
        {presentation.label}
      </Badge>
      {row.carrierStatus && row.carrierStatus !== presentation.label ? (
        <Text style={{ fontSize: 11, lineHeight: 16, color: colors.ink.faint }}>{row.carrierStatus}</Text>
      ) : null}
    </View>
  )
}

export const SELLER_SHIPMENT_COLUMNS = Object.freeze([
  {
    key: 'shipment',
    header: 'Shipment',
    render: (row) => (
      <View>
        <Text noTranslate style={[mono, { fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.slate[900] }]}>
          {row.id.slice(-8).toUpperCase()}
        </Text>
        <Text noTranslate style={{ fontSize: 11, lineHeight: 16, color: colors.ink.subtle }}>
          Order {row.orderId.slice(-8).toUpperCase()} · {row.itemCount} item{row.itemCount === 1 ? '' : 's'}
        </Text>
      </View>
    ),
  },
  { key: 'status', header: 'Status', width: '11rem', render: renderStatus },
  {
    key: 'courier',
    header: 'Courier / AWB',
    width: '12rem',
    render: (row) =>
      row.awbCode ? (
        <View>
          <Text style={{ fontSize: 12, lineHeight: 16, color: colors.slate[900] }}>{row.courierName || 'Assigned'}</Text>
          <Text noTranslate style={[mono, { fontSize: 11, lineHeight: 16, color: colors.ink.subtle }]}>
            {row.awbCode}
          </Text>
        </View>
      ) : (
        <Text style={{ fontSize: 11, lineHeight: 16, color: colors.ink.faint }}>Not assigned</Text>
      ),
  },
  {
    key: 'route',
    header: 'Route',
    width: '10rem',
    render: (row) => (
      <View>
        <Text noTranslate style={{ fontSize: 11, lineHeight: 16, color: colors.ink.subtle }}>
          {row.pickupLocation || row.pickupPincode || '—'}
        </Text>
        <Text noTranslate style={{ fontSize: 11, lineHeight: 16, color: colors.ink.subtle }}>
          → {row.deliveryCity || '—'} {row.deliveryPincode}
        </Text>
      </View>
    ),
  },
  {
    key: 'payment',
    header: 'Payment',
    width: '8rem',
    align: 'right',
    render: (row) => (
      <View style={{ alignItems: 'flex-end' }}>
        <Badge tone={row.paymentMethod === 'COD' ? 'warning' : 'neutral'} size="sm">
          {row.paymentMethod}
        </Badge>
        {row.paymentMethod === 'COD' && row.collectableAmount > 0 ? (
          <Text noTranslate style={{ marginTop: 4, fontSize: 11, lineHeight: 16, color: colors.ink.subtle, fontVariant: ['tabular-nums'] }}>
            collect {formatCarrierRupees(row.collectableAmount)}
          </Text>
        ) : null}
      </View>
    ),
  },
  {
    key: 'createdAt',
    header: 'Created',
    width: '8rem',
    render: (row) => <DateCell value={row.createdAt} />,
  },
])
