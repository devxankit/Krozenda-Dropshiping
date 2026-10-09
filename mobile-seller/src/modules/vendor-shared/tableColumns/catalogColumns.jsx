import { StyleSheet, View } from 'react-native'
import { Image } from 'expo-image'
import { Text, DEFAULT_PRODUCT_IMAGE, resolveImageSource } from '../../../components/ui'
import { StatusPill } from '../../../components/admin/display/cells'
import { withAlpha } from '../../../components/catalog/tw'
import { formatIndian } from '../../../lib/format'
import { colors } from '../../../theme'
import { VENDOR_PRODUCT_STATUS_TONE } from '../constants'

// Catalog (Products) columns of the web's tableColumns/vendorColumns.jsx - only the ones the Products
// screen needs, copied here so this file owns them.

function productStatusOf(row) {
  if (row.approvalStatus === 'PENDING') return 'pending'
  if (row.approvalStatus === 'REJECTED') return 'rejected'
  if (row.stock <= 0) return 'out_of_stock'
  return row.isActive ? 'active' : 'inactive'
}

export const VENDOR_PRODUCT_COLUMNS = Object.freeze([
  {
    key: 'name',
    header: 'SKU / Product',
    width: '15rem',
    render: (row) => (
      <View style={styles.productCell}>
        <View style={styles.thumb}>
          <Image source={resolveImageSource(row.images?.[0] || DEFAULT_PRODUCT_IMAGE)} style={styles.thumbImg} contentFit="contain" />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.name}>{row.name}</Text>
          <View style={styles.subRow}>
            <Text noTranslate style={styles.sub}>
              {row.sku || '—'} · {row.category?.name || 'Uncategorized'}
            </Text>
            {row.isFlashsale ? (
              <View style={[styles.pill, { backgroundColor: colors.warning[50], borderColor: withAlpha(colors.warning[600], 0.2) }]}>
                <Text noTranslate style={[styles.pillText, { color: colors.warning[700] }]}>
                  🔥 Flash
                </Text>
              </View>
            ) : null}
            {row.isTrending ? (
              <View style={[styles.pill, { backgroundColor: colors.brand[50], borderColor: withAlpha(colors.brand[600], 0.2) }]}>
                <Text noTranslate style={[styles.pillText, { color: colors.brand[700] }]}>
                  📈 Trending
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    ),
  },
  {
    key: 'price',
    header: 'Price',
    width: '7.5rem',
    align: 'right',
    render: (row) => (
      <View style={{ alignItems: 'flex-end' }}>
        <Text noTranslate style={styles.price}>
          ₹{formatIndian(row.price)}
        </Text>
        {row.salePrice != null ? (
          <Text noTranslate style={styles.sale}>
            ₹{formatIndian(row.salePrice)}
          </Text>
        ) : null}
      </View>
    ),
  },
  {
    key: 'stock',
    header: 'Stock',
    width: '7rem',
    align: 'right',
    render: (row) => (
      <Text style={[styles.stock, { color: row.stock > 0 ? colors.slate[900] : colors.danger[600] }]}>
        {row.stock > 0 ? `${formatIndian(row.stock)} units` : 'Out of stock'}
      </Text>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    width: '8.5rem',
    render: (row) => <StatusPill status={productStatusOf(row)} tones={VENDOR_PRODUCT_STATUS_TONE} size="sm" />,
  },
])

export const VENDOR_PRODUCT_TABS = Object.freeze([
  { id: 'all', label: 'All Products' },
  { id: 'active', label: 'Active' },
  { id: 'out_of_stock', label: 'Out of Stock' },
  { id: 'pending', label: 'Pending Approval' },
  { id: 'rejected', label: 'Rejected' },
])

const styles = StyleSheet.create({
  productCell: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  thumb: {
    height: 32,
    width: 32,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.slate[100],
    backgroundColor: '#fff',
    padding: 2,
  },
  thumbImg: { height: '100%', width: '100%' },
  name: { fontSize: 12, lineHeight: 16, fontWeight: '500', color: colors.slate[900] },
  subRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 2 },
  sub: { fontSize: 11, lineHeight: 16, color: colors.ink.subtle },
  pill: { borderRadius: 6, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2 },
  pillText: { fontSize: 10, lineHeight: 14, fontWeight: '700' },
  price: { fontSize: 12, fontWeight: '500', color: colors.slate[900] },
  sale: { fontSize: 11, lineHeight: 16, color: colors.success[600] },
  stock: { fontSize: 12, fontWeight: '500' },
})
