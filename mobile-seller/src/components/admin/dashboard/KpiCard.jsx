import { StyleSheet, View } from 'react-native'
import { Icon, Text } from '../../ui'
import { formatMoney } from '../display'
import { SERIES, SparkArea } from '../charts'
import { colors, radius, shadows } from '../../../theme'

// One KPI tile, shared by the dashboard and the analytics screens, so a headline number looks and
// behaves the same wherever it is read.
//
// Colour rule: the arrow follows the MOVEMENT (up/down), the colour follows the SENTIMENT the API
// sends with it. Payloads without a sentiment fall back to "up is good".

const DELTA_TONE = Object.freeze({
  positive: { bg: colors.success[50], fg: colors.success[700] },
  negative: { bg: colors.danger[50], fg: colors.danger[700] },
  neutral: { bg: colors.surface.muted, fg: colors.ink.subtle },
})

// Presentation only: KPI payloads carry a key and a format, not an icon, so the card picks one.
// An explicit `kpi.icon` always wins.
const KPI_ICON = Object.freeze({
  revenue: 'money',
  gmv: 'money',
  netSales: 'money',
  commission: 'percent',
  collected: 'money',
  payout: 'settlements',
  held: 'pause',
  orders: 'orders',
  pending: 'pending',
  aov: 'cart',
  basket: 'cart',
  units: 'inventory',
  sellers: 'sellers',
  products: 'products',
  live: 'live',
  refunds: 'returns',
  refundRate: 'returns',
  returnRate: 'returns',
  rto: 'truck',
  dispatch: 'truck',
  reviews: 'star',
  newBuyers: 'users',
  returningBuyers: 'users',
  repeat: 'users',
  sellThrough: 'trendUp',
  acceptance: 'successCircle',
})

const FORMAT_ICON = Object.freeze({ money: 'money', percent: 'percent' })

function kpiIcon(kpi) {
  return kpi.icon || KPI_ICON[kpi.key] || FORMAT_ICON[kpi.format] || 'activity'
}

function deltaTone(delta) {
  if (delta.sentiment) return DELTA_TONE[delta.sentiment]
  if (delta.direction === 'flat') return DELTA_TONE.neutral
  return delta.direction === 'up' ? DELTA_TONE.positive : DELTA_TONE.negative
}

function formatKpiValue(kpi) {
  if (kpi.format === 'money') return formatMoney(kpi.value, { compact: kpi.value >= 10000000 })
  if (kpi.format === 'percent') return `${kpi.value}%`
  if (kpi.format === 'ratio') return kpi.value.toFixed(1)
  return kpi.value.toLocaleString('en-IN')
}

export function KpiCard({ kpi }) {
  const emphasised = kpi.tone === 'brand'
  const trend = kpi.trend?.length > 1 ? kpi.trend : null
  const tone = kpi.delta ? deltaTone(kpi.delta) : null

  return (
    <View
      style={[
        styles.card,
        emphasised
          ? { borderColor: colors.brand[200], backgroundColor: colors.brand[50] + '66' }
          : { borderColor: colors.border.DEFAULT, backgroundColor: colors.surface.DEFAULT },
      ]}
    >
      {emphasised ? <View style={styles.bar} /> : null}

      <View style={styles.inner}>
        <View style={styles.top}>
          <Text style={[styles.label, { color: emphasised ? colors.brand[600] : colors.ink.subtle }]}>
            {typeof kpi.label === 'string' ? kpi.label.toUpperCase() : kpi.label}
          </Text>
          <View style={[styles.iconTile, { backgroundColor: emphasised ? colors.brand[600] : colors.surface.sunken }, emphasised && shadows.xs]}>
            <Icon name={kpiIcon(kpi)} size={16} color={emphasised ? '#fff' : colors.ink.muted} />
          </View>
        </View>

        <Text noTranslate style={[styles.value, { color: emphasised ? colors.brand[700] : colors.slate[900] }]}>
          {formatKpiValue(kpi)}
        </Text>

        <View style={styles.bottom}>
          {kpi.delta ? (
            <View style={[styles.delta, { backgroundColor: tone.bg }]}>
              {kpi.delta.direction !== 'flat' ? (
                <Icon name={kpi.delta.direction === 'up' ? 'arrowUp' : 'arrowDown'} size={10} color={tone.fg} />
              ) : null}
              <Text noTranslate style={{ fontSize: 11, lineHeight: 16, fontWeight: '600', color: tone.fg }}>
                {kpi.delta.label}
              </Text>
            </View>
          ) : null}
          <Text numberOfLines={1} style={styles.caption}>
            {kpi.caption}
          </Text>
        </View>
      </View>

      {/* Flush along the bottom edge: the shape is context for the number above it. */}
      {trend ? <SparkArea data={trend} color={SERIES[0]} height={40} /> : null}
    </View>
  )
}

export function KpiGrid({ kpis = [] }) {
  return (
    <View style={{ gap: 16 }}>
      {kpis.map((kpi) => (
        <KpiCard key={kpi.key} kpi={kpi} />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  card: { minWidth: 0, overflow: 'hidden', borderRadius: radius.lg, borderWidth: 1, justifyContent: 'space-between', ...shadows.card },
  bar: { position: 'absolute', left: 0, right: 0, top: 0, height: 2, backgroundColor: colors.brand[600] },
  inner: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 },
  top: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  label: { flexShrink: 1, minWidth: 0, paddingTop: 4, fontSize: 11, lineHeight: 15, fontWeight: '600', letterSpacing: 0.55 },
  iconTile: { height: 32, width: 32, alignItems: 'center', justifyContent: 'center', borderRadius: radius.lg },
  value: { marginTop: 6, fontSize: 24, lineHeight: 30, fontWeight: '700', letterSpacing: -0.4, fontVariant: ['tabular-nums'] },
  bottom: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
  delta: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 9999, paddingHorizontal: 6, paddingVertical: 2 },
  caption: { flexShrink: 1, fontSize: 11, lineHeight: 16, color: colors.ink.faint },
})
