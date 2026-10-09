import { StyleSheet, View } from 'react-native'
import { Text } from '../../../components/ui'
import { PageBody, PageHeader } from '../../../components/admin/shell'
import { StatTile } from '../../../components/admin/StatTile'
import { SectionCard } from '../../../components/admin/display'
import { MoneyCell } from '../../../components/admin/display/cells'
import { formatIndian } from '../../../lib/format'
import { colors, sp } from '../../../theme'
import { useVendorAnalyticsController } from '../controllers/useVendorController'

const rupeesText = (paise) => `₹${formatIndian(paise / 100)}`

export function AnalyticsPage() {
  const { data, isLoading } = useVendorAnalyticsController()

  if (isLoading || !data) {
    return (
      <PageBody>
        <PageHeader title="Analytics" description="Sales trend, top products and order mix for the last 30 days." />
        <Text style={styles.muted}>Loading analytics…</Text>
      </PageBody>
    )
  }

  const totalRevenue = data.salesTrend.reduce((sum, d) => sum + d.revenue, 0)
  const totalOrders = data.salesTrend.reduce((sum, d) => sum + d.orders, 0)
  const top = data.topProducts[0]

  return (
    <PageBody>
      <PageHeader title="Analytics" description="Sales trend, top products and order mix for the last 30 days." />

      <View style={styles.grid}>
        <View style={styles.cell}>
          <StatTile label="Revenue (30d)" value={rupeesText(totalRevenue)} tone="brand" />
        </View>
        <View style={styles.cell}>
          <StatTile label="Orders (30d)" value={totalOrders} />
        </View>
        <View style={styles.cell}>
          <StatTile label="Active Products" value={data.productsActive} caption={`of ${data.productsTotal} total`} />
        </View>
        <View style={styles.cell}>
          <StatTile label="Top Product Revenue" value={top ? rupeesText(top.revenue) : '—'} caption={top?.name || ''} />
        </View>
      </View>

      <SectionCard title="Top Products" description="Ranked by revenue, all-time">
        <View>
          {data.topProducts.length === 0 ? <Text style={styles.empty}>No sales yet.</Text> : null}
          {data.topProducts.map((p, idx) => (
            <View key={p.productId} style={[styles.row, idx > 0 && styles.divider]}>
              <Text noTranslate style={styles.rowName}>
                {idx + 1}. {p.name}
              </Text>
              <View style={styles.rowRight}>
                <Text noTranslate style={styles.muted}>
                  {p.unitsSold} sold
                </Text>
                <MoneyCell amount={p.revenue} compact style={styles.money} />
              </View>
            </View>
          ))}
        </View>
      </SectionCard>

      <SectionCard title="Order Status Mix" description="All-time, across your line items">
        <View style={styles.mix}>
          {Object.entries(data.orderStatusBreakdown).map(([status, count]) => (
            <View key={status} style={styles.mixCell}>
              <View style={styles.mixBox}>
                <Text noTranslate style={styles.mixCount}>
                  {count}
                </Text>
                <Text noTranslate style={styles.mixLabel}>
                  {status}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </SectionCard>
    </PageBody>
  )
}

const styles = StyleSheet.create({
  muted: { fontSize: 12, lineHeight: 16, color: colors.ink.subtle },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: sp(2) },
  cell: { width: '48.5%', flexGrow: 1, minWidth: 0 },
  empty: { padding: sp(4), fontSize: 12, lineHeight: 16, color: colors.ink.subtle },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: sp(3), paddingHorizontal: sp(4), paddingVertical: sp(3) },
  divider: { borderTopWidth: 1, borderTopColor: colors.border.DEFAULT },
  rowName: { flex: 1, minWidth: 0, fontSize: 12, lineHeight: 16, fontWeight: '500', color: colors.slate[900] },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: sp(4), flexShrink: 0 },
  money: { fontSize: 12, lineHeight: 16 },
  mix: { flexDirection: 'row', flexWrap: 'wrap', padding: sp(2) },
  mixCell: { width: '50%', padding: sp(1.5) },
  mixBox: { borderRadius: 12, borderWidth: 1, borderColor: colors.border.DEFAULT, padding: sp(3), alignItems: 'center' },
  mixCount: { fontSize: 18, lineHeight: 28, fontWeight: '700', color: colors.slate[900] },
  mixLabel: { fontSize: 11, lineHeight: 16, color: colors.ink.subtle },
})
