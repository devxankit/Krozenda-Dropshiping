import { useMemo, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg'
import { Icon, SmartImage, Text } from '../../../../components/ui'
import { PressableScale } from '../../../../components/ui/motion'
import { PageBody } from '../../../../components/admin/shell'
import { formatMoney, formatRelativeTime } from '../../../../lib/format'
import { SELLER_ROUTES } from '../../../../config/routes'
import { colors, fonts, radius, shadows } from '../../../../theme'
import { VENDOR_ORDER_STATUS_TONE } from '../../constants'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Tailwind `/NN` colour opacity on a hex token.
const alpha = (hex, pct) => `${hex}${Math.round((pct / 100) * 255).toString(16).padStart(2, '0')}`

const STATUS_PILL_STYLES = {
  warning: { bg: colors.amber[50], fg: colors.amber[700], border: alpha(colors.amber[200], 80) },
  brand: { bg: colors.blue[50], fg: colors.blue[700], border: alpha(colors.blue[200], 80) },
  success: { bg: colors.emerald[50], fg: colors.emerald[700], border: alpha(colors.emerald[200], 80) },
  danger: { bg: colors.rose[50], fg: colors.rose[700], border: alpha(colors.rose[200], 80) },
  neutral: { bg: colors.slate[100], fg: colors.slate[700], border: colors.slate[200] },
}

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function shortDate(dateStr) {
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return dateStr
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]}`
}

function todayLabel() {
  const d = new Date()
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`
}

// ---- revenue chart (react-native-svg version of the web's recharts AreaChart) ----------------

function sign(x) {
  return x < 0 ? -1 : 1
}
function slope3(p0, p1, p2) {
  const h0 = p1.x - p0.x
  const h1 = p2.x - p1.x
  const s0 = (p1.y - p0.y) / (h0 || (h1 < 0 ? -0 : 0))
  const s1 = (p2.y - p1.y) / (h1 || (h0 < 0 ? -0 : 0))
  const p = (s0 * h1 + s1 * h0) / (h0 + h1)
  return (sign(s0) + sign(s1)) * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(p)) || 0
}
function slope2(p0, p1, t) {
  const h = p1.x - p0.x
  return h ? ((3 * (p1.y - p0.y)) / h - t) / 2 : t
}
// Monotone cubic (recharts type="monotone").
function monotone(points) {
  const n = points.length
  if (n === 0) return ''
  if (n === 1) return `M${points[0].x},${points[0].y}`
  const t = new Array(n)
  if (n === 2) {
    t[0] = t[1] = (points[1].y - points[0].y) / (points[1].x - points[0].x || 1)
  } else {
    for (let i = 1; i < n - 1; i += 1) t[i] = slope3(points[i - 1], points[i], points[i + 1])
    t[0] = slope2(points[0], points[1], t[1])
    t[n - 1] = slope2(points[n - 2], points[n - 1], t[n - 2])
  }
  let d = `M${points[0].x},${points[0].y}`
  for (let i = 0; i < n - 1; i += 1) {
    const a = points[i]
    const b = points[i + 1]
    const dx = (b.x - a.x) / 3
    d += `C${a.x + dx},${a.y + dx * t[i]},${b.x - dx},${b.y - dx * t[i + 1]},${b.x},${b.y}`
  }
  return d
}

function niceTicks(max, intervals = 4) {
  if (!(max > 0)) return [0, 1]
  const raw = max / intervals
  const pow = 10 ** Math.floor(Math.log10(raw))
  const frac = raw / pow
  const step = (frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 2.5 ? 2.5 : frac <= 5 ? 5 : 10) * pow
  const count = Math.ceil(max / step)
  return Array.from({ length: count + 1 }, (_, index) => index * step)
}

const tickRupees = (val) => `₹${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`

const CHART_H = 144
const PLOT = { left: 18, right: 4, top: 4, xAxis: 24 }

function RevenueChart({ data }) {
  const [width, setWidth] = useState(0)
  const [active, setActive] = useState(null)
  const n = data.length
  const x0 = PLOT.left
  const x1 = width - PLOT.right
  const y0 = PLOT.top
  const y1 = CHART_H - PLOT.xAxis
  const plotW = Math.max(0, x1 - x0)
  const plotH = y1 - y0

  const ticks = useMemo(() => niceTicks(Math.max(0, ...data.map((p) => p.rupees))), [data])
  const top = ticks[ticks.length - 1]
  const xAt = (i) => (n > 1 ? x0 + (i / (n - 1)) * plotW : x0 + plotW / 2)
  const yAt = (v) => (top ? y1 - (v / top) * plotH : y1)

  const points = data.map((p, i) => ({ x: xAt(i), y: yAt(p.rupees) }))
  const line = width > 0 ? monotone(points) : ''
  const area = line && n > 0 ? `${line}L${points[n - 1].x},${y1}L${points[0].x},${y1}Z` : ''

  // preserveStartEnd: first, last and a few evenly spaced labels between
  const labelCount = Math.min(n, Math.max(2, Math.floor(plotW / 56)))
  const labelIdx = new Set()
  for (let k = 0; k < labelCount; k += 1) labelIdx.add(labelCount > 1 ? Math.round((k * (n - 1)) / (labelCount - 1)) : 0)

  function onPress(event) {
    const { locationX } = event.nativeEvent
    if (locationX < x0 - 8 || locationX > x1 + 8) {
      setActive(null)
      return
    }
    const index = n > 1 ? Math.round(((locationX - x0) / plotW) * (n - 1)) : 0
    setActive(Math.min(n - 1, Math.max(0, index)))
  }

  const activePoint = active != null && active < n ? data[active] : null
  const activeX = activePoint ? xAt(active) : 0
  const tipOnLeft = activeX > x0 + plotW / 2

  return (
    <Pressable
      style={{ height: CHART_H, width: '100%' }}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      onPress={onPress}
    >
      {width > 0 ? (
        <Svg width={width} height={CHART_H}>
          <Defs>
            <LinearGradient id="mobileSalesGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#2563eb" stopOpacity={0.22} />
              <Stop offset="1" stopColor="#2563eb" stopOpacity={0.01} />
            </LinearGradient>
          </Defs>
          {ticks.map((tick) => (
            <G key={`g${tick}`}>
              <Line x1={x0} x2={x1} y1={yAt(tick)} y2={yAt(tick)} stroke="#f1f5f9" strokeWidth={1} strokeDasharray="3 3" />
              <SvgText x={x0 - 4} y={yAt(tick) + 3} fontSize={9.5} fill="#94a3b8" textAnchor="end" fontFamily={fonts[400]}>
                {tickRupees(tick)}
              </SvgText>
            </G>
          ))}
          {data.map((p, i) =>
            labelIdx.has(i) ? (
              <SvgText
                key={`x${p.date}${i}`}
                x={xAt(i)}
                y={y1 + 16}
                fontSize={9.5}
                fill="#94a3b8"
                textAnchor={i === 0 && n > 1 ? 'start' : i === n - 1 && n > 1 ? 'end' : 'middle'}
                fontFamily={fonts[400]}
              >
                {p.label}
              </SvgText>
            ) : null,
          )}
          {area ? <Path d={area} fill="url(#mobileSalesGrad)" stroke="none" /> : null}
          {line ? <Path d={line} fill="none" stroke="#2563eb" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /> : null}
          {activePoint ? (
            <G>
              <Line x1={activeX} x2={activeX} y1={y0} y2={y1} stroke="#cbd5e1" strokeWidth={1} />
              <Circle cx={activeX} cy={yAt(activePoint.rupees)} r={3.5} fill="#2563eb" stroke="#ffffff" strokeWidth={1.5} />
            </G>
          ) : null}
        </Svg>
      ) : null}
      {activePoint ? (
        <View pointerEvents="none" style={[styles.tip, tipOnLeft ? { right: width - activeX + 8 } : { left: activeX + 8 }]}>
          <Text noTranslate style={styles.tipLabel}>
            {activePoint.label}
          </Text>
          <Text noTranslate style={styles.tipValue}>
            {formatMoney(activePoint.revenue)}
          </Text>
          <Text noTranslate style={styles.tipOrders}>
            {activePoint.orders} orders
          </Text>
        </View>
      ) : null}
    </Pressable>
  )
}

// ---- small pieces -----------------------------------------------------------------------------

// from-brand-600 to-indigo-600, bottom-left to top-right
function GradientTile({ children }) {
  return (
    <View style={styles.avatar}>
      <Svg width={36} height={36} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="avatarGrad" x1="0" y1="1" x2="1" y2="0">
            <Stop offset="0" stopColor={colors.brand[600]} />
            <Stop offset="1" stopColor={colors.indigo[600]} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={36} height={36} fill="url(#avatarGrad)" />
      </Svg>
      {children}
    </View>
  )
}

function Section({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>
}

function LinkText({ children, onPress, style, icon, iconSize = 10 }) {
  return (
    <Pressable onPress={onPress} style={styles.linkRow} hitSlop={6}>
      <Text style={style}>{children}</Text>
      {icon ? <Icon name={icon} size={iconSize} color={style?.color} /> : null}
    </Pressable>
  )
}

export function MobileSellerDashboard({ summary, analytics, orders }) {
  const router = useRouter()
  const go = (path) => () => router.push(path)
  const [chartRange, setChartRange] = useState('30D') // '7D' | '30D'
  const greeting = getGreeting()

  const salesTrend = useMemo(() => analytics?.salesTrend ?? [], [analytics])
  const statusBreakdown = analytics?.orderStatusBreakdown ?? {}

  // Filter trend data according to selected period
  const filteredTrend = useMemo(() => {
    if (!salesTrend.length) return []
    const count = chartRange === '7D' ? 7 : 30
    return salesTrend.slice(-count).map((point) => ({
      date: point.date,
      label: shortDate(point.date),
      revenue: point.revenue,
      rupees: Math.round(point.revenue / 100),
      orders: point.orders,
    }))
  }, [salesTrend, chartRange])

  const totalPeriodRevenue = useMemo(
    () => filteredTrend.reduce((acc, curr) => acc + (curr.revenue || 0), 0),
    [filteredTrend],
  )

  const recentOrdersList = (orders?.items || []).slice(0, 5)

  const pendingCount = summary?.pendingOrdersCount || 0
  const processingCount = statusBreakdown?.PROCESSING || 0
  const shippedCount = statusBreakdown?.SHIPPED || 0
  const deliveredCount = statusBreakdown?.DELIVERED || 0
  const cancelledCount = statusBreakdown?.CANCELLED || 0

  const shortcuts = [
    { label: 'Add SKU', icon: 'add', to: SELLER_ROUTES.PRODUCTS, bg: colors.blue[50], fg: colors.blue[600] },
    { label: 'Orders', icon: 'orders', to: SELLER_ROUTES.ORDERS, bg: colors.amber[50], fg: colors.amber[600], badge: pendingCount },
    { label: 'Payouts', icon: 'settlements', to: SELLER_ROUTES.EARNINGS, bg: colors.emerald[50], fg: colors.emerald[600] },
    { label: 'Analytics', icon: 'analytics', to: SELLER_ROUTES.ANALYTICS, bg: colors.purple[50], fg: colors.purple[600] },
    { label: 'KYC Docs', icon: 'kyc', to: SELLER_ROUTES.KYC_DOCUMENTS, bg: colors.rose[50], fg: colors.rose[600] },
  ]

  const pipeline = [
    { label: 'Pending', count: pendingCount, c: colors.amber },
    { label: 'Processing', count: processingCount, c: colors.blue },
    { label: 'Shipped', count: shippedCount, c: colors.purple },
    { label: 'Delivered', count: deliveredCount, c: colors.emerald },
  ]

  const hub = [
    { label: 'Inventory', sub: 'Stock levels', icon: 'inventory', fg: colors.blue[600], to: SELLER_ROUTES.INVENTORY },
    { label: 'Shipping', sub: 'Labels & AWB', icon: 'shipments', fg: colors.emerald[600], to: SELLER_ROUTES.SHIPPING },
    { label: 'Reviews', sub: 'Buyer feedback', icon: 'reviews', fg: colors.amber[600], to: SELLER_ROUTES.REVIEWS },
    { label: 'Coupons', sub: 'Discounts', icon: 'coupons', fg: colors.purple[600], to: SELLER_ROUTES.COUPONS },
  ]

  return (
    <PageBody contentStyle={styles.page}>
      {/* 1. Store Header & Greeting Card */}
      <Section style={styles.headerCard}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <GradientTile>
              <Text noTranslate style={styles.avatarText}>
                {summary?.storeName ? summary.storeName.slice(0, 2).toUpperCase() : 'AM'}
              </Text>
            </GradientTile>
            <View style={{ minWidth: 0, flexShrink: 1 }}>
              <View style={styles.greetRow}>
                <Text numberOfLines={1} style={styles.greeting}>
                  {greeting},
                </Text>
                <Text noTranslate style={styles.dateText}>
                  {todayLabel()}
                </Text>
              </View>
              <View style={styles.nameRow}>
                <Text noTranslate numberOfLines={1} style={styles.storeName}>
                  {summary?.storeName || 'Arya Manufacturing'}
                </Text>
                <Icon name="HiCheckCircle" size={14} color={colors.brand[600]} />
                <View style={styles.activePill}>
                  <View style={styles.activeDot} />
                  <Text style={styles.activeText}>Active</Text>
                </View>
              </View>
            </View>
          </View>

          <PressableScale scaleTo={0.95} onPress={go(SELLER_ROUTES.PRODUCTS)} style={[styles.addBtn, shadows.xs]}>
            <Icon name="add" size={12} color="#fff" />
            <Text style={styles.addBtnText}>Add SKU</Text>
          </PressableScale>
        </View>
      </Section>

      {/* 2. KYC Alert Banner (if pending) */}
      {summary?.kycStatus !== 'approved' ? (
        <View style={styles.kyc}>
          <View style={styles.kycIcon}>
            <Icon name="shield" size={16} color="#fff" />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={styles.kycTop}>
              <Text style={styles.kycTitle}>KYC Verification Required</Text>
              <LinkText onPress={go(SELLER_ROUTES.KYC_DOCUMENTS)} style={styles.kycLink} icon="arrowRight">
                Verify
              </LinkText>
            </View>
            <Text style={styles.kycBody}>Upload PAN, GST & Bank details to unlock automated direct settlements.</Text>
          </View>
        </View>
      ) : null}

      {/* 3. Fast Action Shortcut Grid */}
      <View style={styles.shortcuts}>
        {shortcuts.map((s) => (
          <PressableScale key={s.label} scaleTo={0.95} onPress={go(s.to)} style={styles.shortcut}>
            {s.badge > 0 ? (
              <View style={styles.shortcutBadge}>
                <Text noTranslate style={styles.shortcutBadgeText}>
                  {s.badge}
                </Text>
              </View>
            ) : null}
            <View style={[styles.shortcutIcon, { backgroundColor: s.bg }]}>
              <Icon name={s.icon} size={14} color={s.fg} />
            </View>
            <Text style={styles.shortcutLabel}>{s.label}</Text>
          </PressableScale>
        ))}
      </View>

      {/* 4. KPI Metric Cards (2x2 Grid) */}
      <View style={styles.kpiGrid}>
        <View style={styles.kpiCell}>
          <View style={styles.kpiCard}>
            <View style={styles.kpiTop}>
              <Text style={styles.kpiLabel}>Delivered Revenue</Text>
              <View style={[styles.kpiIcon, { backgroundColor: colors.emerald[50] }]}>
                <Icon name="money" size={12} color={colors.emerald[600]} />
              </View>
            </View>
            <Text noTranslate style={styles.kpiValue}>
              {formatMoney(summary?.totalRevenue ?? 0)}
            </Text>
            <View style={styles.kpiSub}>
              <Icon name="check" size={10} color={colors.emerald[700]} />
              <Text style={[styles.kpiSubText, { color: colors.emerald[700] }]}>Completed orders</Text>
            </View>
          </View>
        </View>

        <View style={styles.kpiCell}>
          <PressableScale scaleTo={0.98} onPress={go(SELLER_ROUTES.ORDERS)} style={styles.kpiCard}>
            <View style={styles.kpiTop}>
              <Text style={styles.kpiLabel}>Pending Orders</Text>
              <View style={[styles.kpiIcon, { backgroundColor: colors.amber[50] }]}>
                <Icon name="pending" size={12} color={colors.amber[600]} />
              </View>
            </View>
            <Text noTranslate style={styles.kpiValue}>
              {pendingCount}
            </Text>
            <View style={styles.kpiSub}>
              <Text style={[styles.kpiSubText, { color: colors.amber[700] }]}>Action required</Text>
              <Icon name="chevronRight" size={10} color={colors.amber[700]} />
            </View>
          </PressableScale>
        </View>

        <View style={styles.kpiCell}>
          <PressableScale scaleTo={0.98} onPress={go(SELLER_ROUTES.PRODUCTS)} style={styles.kpiCard}>
            <View style={styles.kpiTop}>
              <Text style={styles.kpiLabel}>Live Products</Text>
              <View style={[styles.kpiIcon, { backgroundColor: colors.blue[50] }]}>
                <Icon name="products" size={12} color={colors.blue[600]} />
              </View>
            </View>
            <Text noTranslate style={styles.kpiValue}>
              {summary?.liveSkusCount ?? 0}
            </Text>
            <View style={styles.kpiSub}>
              <Icon name="live" size={10} color={colors.blue[700]} />
              <Text style={[styles.kpiSubText, { color: colors.blue[700] }]}>Active in catalog</Text>
            </View>
          </PressableScale>
        </View>

        <View style={styles.kpiCell}>
          <PressableScale scaleTo={0.98} onPress={go(SELLER_ROUTES.EARNINGS)} style={styles.kpiCard}>
            <View style={styles.kpiTop}>
              <Text style={styles.kpiLabel}>Due Payout</Text>
              <View style={[styles.kpiIcon, { backgroundColor: colors.purple[50] }]}>
                <Icon name="settlements" size={12} color={colors.purple[600]} />
              </View>
            </View>
            <Text noTranslate style={styles.kpiValue}>
              {formatMoney(summary?.availablePayout ?? 0)}
            </Text>
            <Text style={[styles.kpiSubText, { color: colors.purple[700], marginTop: 2 }]}>Settlement due</Text>
          </PressableScale>
        </View>
      </View>

      {/* 5. Order Pipeline Fulfillment Funnel */}
      <Section>
        <View style={styles.sectionHead}>
          <View style={styles.sectionHeadLeft}>
            <Text style={styles.sectionTitle}>Order Pipeline</Text>
            <Text style={styles.sectionHint}>Live breakdown</Text>
          </View>
          <LinkText onPress={go(SELLER_ROUTES.ORDERS)} style={styles.link} icon="chevronRight">
            All Orders
          </LinkText>
        </View>

        <View style={styles.pipeline}>
          {pipeline.map((p) => (
            <PressableScale
              key={p.label}
              scaleTo={0.95}
              onPress={go(SELLER_ROUTES.ORDERS)}
              style={[styles.stage, { backgroundColor: alpha(p.c[50], 70), borderColor: alpha(p.c[200], 50) }]}
            >
              <Text noTranslate style={[styles.stageCount, { color: p.c[800] }]}>
                {p.count}
              </Text>
              <Text style={[styles.stageLabel, { color: p.c[700] }]}>{p.label}</Text>
            </PressableScale>
          ))}
        </View>

        {cancelledCount > 0 ? (
          <View style={styles.cancelled}>
            <View style={styles.cancelledLeft}>
              <Icon name="danger" size={12} color={colors.rose[700]} />
              <Text noTranslate style={styles.cancelledText}>
                {cancelledCount} Cancelled Orders
              </Text>
            </View>
            <Pressable onPress={go(SELLER_ROUTES.ORDERS)} hitSlop={6}>
              <Text style={styles.cancelledView}>View</Text>
            </Pressable>
          </View>
        ) : null}
      </Section>

      {/* 6. Revenue Trend Performance Chart */}
      <Section>
        <View style={[styles.sectionHead, { marginBottom: 6 }]}>
          <View style={{ flexShrink: 1 }}>
            <Text style={styles.sectionTitle}>Revenue Trend</Text>
            <Text style={styles.trendSub}>
              {chartRange === '7D' ? 'Last 7 days' : 'Last 30 days'}:{' '}
              <Text noTranslate style={styles.trendStrong}>
                {formatMoney(totalPeriodRevenue)}
              </Text>
            </Text>
          </View>

          <View style={styles.seg}>
            {['7D', '30D'].map((r) => (
              <Pressable
                key={r}
                onPress={() => setChartRange(r)}
                style={[styles.segItem, chartRange === r && [styles.segItemOn, shadows.xs]]}
              >
                <Text noTranslate style={[styles.segText, { color: chartRange === r ? colors.brand[700] : colors.slate[500] }]}>
                  {r}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={{ height: CHART_H, marginTop: 4 }}>
          {filteredTrend.length > 0 ? (
            <RevenueChart data={filteredTrend} />
          ) : (
            <View style={styles.noChart}>
              <Text style={styles.noChartText}>No revenue recorded for this period</Text>
            </View>
          )}
        </View>
      </Section>

      {/* 7. Recent Orders */}
      <View style={{ gap: 6 }}>
        <View style={styles.recentHead}>
          <Text style={styles.sectionTitle}>Recent Orders</Text>
          <LinkText onPress={go(SELLER_ROUTES.ORDERS)} style={styles.link} icon="chevronRight">
            {`View All (${orders?.total ?? recentOrdersList.length})`}
          </LinkText>
        </View>

        {recentOrdersList.length === 0 ? (
          <View style={styles.emptyOrders}>
            <View style={styles.emptyIcon}>
              <Icon name="orders" size={16} color={colors.slate[400]} />
            </View>
            <Text style={styles.emptyTitle}>No Orders Placed Yet</Text>
            <Text style={styles.emptySub}>Live orders from buyers will appear here.</Text>
          </View>
        ) : (
          <View style={{ gap: 6 }}>
            {recentOrdersList.map((order) => {
              const tone = VENDOR_ORDER_STATUS_TONE[order.status] || 'neutral'
              const pill = STATUS_PILL_STYLES[tone] || STATUS_PILL_STYLES.neutral
              const firstItem = order.items?.[0]
              const itemsCount = order.items?.length || 1

              return (
                <PressableScale key={order.id} scaleTo={0.99} onPress={go(SELLER_ROUTES.ORDERS)} style={styles.orderCard}>
                  <View style={styles.orderTop}>
                    <View style={styles.orderTopLeft}>
                      <View style={styles.orderId}>
                        <Text noTranslate style={styles.orderIdText}>
                          #{order.id.slice(-8).toUpperCase()}
                        </Text>
                      </View>
                      <Text noTranslate style={styles.orderTime}>
                        {order.createdAt ? formatRelativeTime(order.createdAt) : 'Recent'}
                      </Text>
                    </View>
                    <View style={[styles.statusPill, { backgroundColor: pill.bg, borderColor: pill.border }]}>
                      <Text noTranslate style={[styles.statusText, { color: pill.fg }]}>
                        {String(order.status).toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.orderBody}>
                    <View style={styles.thumb}>
                      {firstItem?.image ? (
                        <SmartImage src={firstItem.image} alt={firstItem.name} fit="cover" style={{ width: '100%', height: '100%' }} />
                      ) : (
                        <Icon name="products" size={16} color={colors.slate[400]} />
                      )}
                    </View>

                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text noTranslate numberOfLines={1} style={styles.orderName}>
                        {firstItem?.name || 'Catalog Item'}
                      </Text>
                      <Text noTranslate numberOfLines={1} style={styles.orderBuyer}>
                        Buyer: <Text noTranslate style={styles.orderBuyerName}>{order.customer?.name || 'Customer'}</Text>
                        {itemsCount > 1 ? ` • +${itemsCount - 1} more` : ''}
                      </Text>
                    </View>

                    <View style={{ alignItems: 'flex-end', flexShrink: 0 }}>
                      <Text noTranslate style={styles.orderValue}>
                        {formatMoney(order.itemsValue ?? 0)}
                      </Text>
                      <View style={styles.processRow}>
                        <Text style={styles.processText}>Process</Text>
                        <Icon name="chevronRight" size={8} color={colors.brand[600]} />
                      </View>
                    </View>
                  </View>
                </PressableScale>
              )
            })}

            <Pressable onPress={go(SELLER_ROUTES.ORDERS)} style={styles.viewAll}>
              <Text style={styles.viewAllText}>View All Orders</Text>
              <Icon name="arrowRight" size={12} color={colors.slate[700]} />
            </Pressable>
          </View>
        )}
      </View>

      {/* 8. Seller Tools Quick Hub */}
      <Section>
        <Text style={[styles.sectionTitle, { marginBottom: 8 }]}>Management Hub</Text>
        <View style={styles.hubGrid}>
          {hub.map((h) => (
            <View key={h.label} style={styles.hubCell}>
              <Pressable onPress={go(h.to)} style={styles.hubItem}>
                <View style={[styles.hubIcon, shadows.xs]}>
                  <Icon name={h.icon} size={14} color={h.fg} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={styles.hubLabel}>
                    {h.label}
                  </Text>
                  <Text numberOfLines={1} style={styles.hubSub}>
                    {h.sub}
                  </Text>
                </View>
              </Pressable>
            </View>
          ))}
        </View>
      </Section>

      {/* 9. Support & Live Sync Footer */}
      <View style={styles.footer}>
        <View style={styles.footerLeft}>
          <View style={styles.activeDot} />
          <Text style={styles.footerText}>Krozenda Seller • Realtime</Text>
        </View>
        <Pressable onPress={go(SELLER_ROUTES.TICKETS)} hitSlop={6}>
          <Text style={styles.footerLink}>Help & Support</Text>
        </Pressable>
      </View>
    </PageBody>
  )
}

const CARD_BORDER = alpha(colors.slate[200], 80)

const styles = StyleSheet.create({
  page: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 24, gap: 10, backgroundColor: alpha(colors.slate[50], 70) },
  card: { borderRadius: radius.xl, borderWidth: 1, borderColor: CARD_BORDER, backgroundColor: '#fff', padding: 10, ...shadows['2xs'] },

  headerCard: {},
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0, flexShrink: 1 },
  avatar: { height: 36, width: 36, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarText: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: '#fff' },
  greetRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  greeting: { flexShrink: 1, fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.slate[500] },
  dateText: { fontSize: 10, lineHeight: 15, color: colors.slate[400] },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  storeName: { maxWidth: 170, flexShrink: 1, fontSize: 14, lineHeight: 20, fontWeight: '700', letterSpacing: -0.35, color: colors.slate[900] },
  activePill: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 2,
    borderRadius: radius.DEFAULT,
    borderWidth: 1,
    borderColor: alpha(colors.emerald[200], 60),
    backgroundColor: colors.emerald[50],
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  activeDot: { height: 6, width: 6, borderRadius: 3, backgroundColor: colors.emerald[500] },
  activeText: { fontSize: 9.5, lineHeight: 14, fontWeight: '600', color: colors.emerald[700] },
  addBtn: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radius.lg, backgroundColor: colors.brand[600], paddingHorizontal: 10, paddingVertical: 6 },
  addBtnText: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: '#fff' },

  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  link: { fontSize: 11, lineHeight: 16, fontWeight: '600', color: colors.brand[600] },

  kyc: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: alpha(colors.amber[200], 80),
    backgroundColor: alpha(colors.amber[50], 70),
    padding: 10,
  },
  kycIcon: { height: 28, width: 28, marginTop: 2, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.amber[500], ...shadows.xs },
  kycTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kycTitle: { fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: -0.3, color: colors.amber[900] },
  kycLink: { fontSize: 11, lineHeight: 16, fontWeight: '700', color: colors.amber[900] },
  kycBody: { marginTop: 2, fontSize: 11, lineHeight: 15, color: colors.amber[800] },

  shortcuts: { flexDirection: 'row', gap: 6 },
  shortcut: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: alpha(colors.slate[200], 70),
    backgroundColor: '#fff',
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  shortcutBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    zIndex: 1,
    height: 14,
    minWidth: 14,
    paddingHorizontal: 2,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.amber[500],
  },
  shortcutBadgeText: { fontSize: 8.5, lineHeight: 12, fontWeight: '700', color: '#fff' },
  shortcutIcon: { height: 28, width: 28, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  shortcutLabel: { fontSize: 10, lineHeight: 10, fontWeight: '600', textAlign: 'center', color: colors.slate[700] },

  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kpiCell: { width: '48.5%', flexGrow: 1 },
  kpiCard: { borderRadius: radius.xl, borderWidth: 1, borderColor: CARD_BORDER, backgroundColor: '#fff', padding: 10, ...shadows['2xs'] },
  kpiTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kpiLabel: { flexShrink: 1, fontSize: 11, lineHeight: 16, fontWeight: '600', color: colors.slate[500] },
  kpiIcon: { height: 20, width: 20, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  kpiValue: { marginTop: 4, fontSize: 18, lineHeight: 28, fontWeight: '700', letterSpacing: -0.45, color: colors.slate[900], fontVariant: ['tabular-nums'] },
  kpiSub: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  kpiSubText: { fontSize: 10, lineHeight: 15, fontWeight: '500' },

  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sectionHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: -0.3, color: colors.slate[900] },
  sectionHint: { fontSize: 10, lineHeight: 15, fontWeight: '500', color: colors.slate[400] },

  pipeline: { flexDirection: 'row', gap: 6 },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: radius.lg, borderWidth: 1, padding: 6 },
  stageCount: { fontSize: 12, lineHeight: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
  stageLabel: { fontSize: 9.5, lineHeight: 14, fontWeight: '600' },
  cancelled: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.rose[100],
    backgroundColor: colors.rose[50],
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  cancelledLeft: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cancelledText: { fontSize: 10, lineHeight: 15, fontWeight: '500', color: colors.rose[700] },
  cancelledView: { fontSize: 10, lineHeight: 15, fontWeight: '700', textDecorationLine: 'underline', color: colors.rose[700] },

  trendSub: { fontSize: 10, lineHeight: 15, color: colors.slate[500] },
  trendStrong: { fontSize: 10, lineHeight: 15, fontWeight: '600', color: colors.slate[900] },
  seg: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.lg, borderWidth: 1, borderColor: alpha(colors.slate[200], 60), backgroundColor: colors.slate[100], padding: 2 },
  segItem: { borderRadius: radius.md, paddingHorizontal: 8, paddingVertical: 2 },
  segItemOn: { backgroundColor: '#fff' },
  segText: { fontSize: 10, lineHeight: 15, fontWeight: '700' },
  noChart: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  noChartText: { fontSize: 12, lineHeight: 16, color: colors.slate[400] },
  tip: {
    position: 'absolute',
    top: 0,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.slate[200],
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    ...shadows.md,
  },
  tipLabel: { fontSize: 9.5, lineHeight: 14, fontWeight: '500', color: colors.slate[500] },
  tipValue: { fontSize: 11, lineHeight: 16, fontWeight: '700', color: colors.brand[700] },
  tipOrders: { fontSize: 9.5, lineHeight: 14, color: colors.slate[600] },

  recentHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2 },
  emptyOrders: { alignItems: 'center', borderRadius: radius.xl, borderWidth: 1, borderColor: CARD_BORDER, backgroundColor: '#fff', padding: 16 },
  emptyIcon: { height: 36, width: 36, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.slate[100] },
  emptyTitle: { marginTop: 6, fontSize: 12, lineHeight: 16, fontWeight: '700', color: colors.slate[700] },
  emptySub: { fontSize: 10, lineHeight: 15, color: colors.slate[400] },

  orderCard: { borderRadius: radius.xl, borderWidth: 1, borderColor: CARD_BORDER, backgroundColor: '#fff', padding: 10, ...shadows['2xs'] },
  orderTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.slate[100], paddingBottom: 6 },
  orderTopLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  orderId: { borderRadius: radius.DEFAULT, borderWidth: 1, borderColor: colors.brand[100], backgroundColor: colors.brand[50], paddingHorizontal: 6, paddingVertical: 2 },
  orderIdText: { fontSize: 10, lineHeight: 15, fontWeight: '700', color: colors.brand[700] },
  orderTime: { fontSize: 10, lineHeight: 15, color: colors.slate[400] },
  statusPill: { borderRadius: radius.DEFAULT, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2 },
  statusText: { fontSize: 9, lineHeight: 13, fontWeight: '700', letterSpacing: 0.9 },
  orderBody: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 8 },
  thumb: {
    height: 36,
    width: 36,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: alpha(colors.slate[200], 60),
    backgroundColor: colors.slate[100],
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  orderName: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.slate[900] },
  orderBuyer: { fontSize: 10, lineHeight: 15, color: colors.slate[500] },
  orderBuyerName: { fontSize: 10, lineHeight: 15, fontWeight: '500', color: colors.slate[700] },
  orderValue: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: colors.slate[900], fontVariant: ['tabular-nums'] },
  processRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  processText: { fontSize: 10, lineHeight: 15, fontWeight: '600', color: colors.brand[600] },
  viewAll: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    backgroundColor: '#fff',
    paddingVertical: 8,
    ...shadows['2xs'],
  },
  viewAllText: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.slate[700] },

  hubGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  hubCell: { width: '48.5%', flexGrow: 1 },
  hubItem: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.slate[100], backgroundColor: alpha(colors.slate[50], 60), padding: 8 },
  hubIcon: { height: 28, width: 28, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  hubLabel: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: colors.slate[800] },
  hubSub: { fontSize: 9.5, lineHeight: 14, color: colors.slate[400] },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.lg,
    backgroundColor: alpha(colors.slate[200], 50),
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  footerLeft: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  footerText: { fontSize: 10, lineHeight: 15, fontWeight: '500', color: colors.slate[500] },
  footerLink: { fontSize: 10, lineHeight: 15, fontWeight: '600', color: colors.brand[700] },
})
