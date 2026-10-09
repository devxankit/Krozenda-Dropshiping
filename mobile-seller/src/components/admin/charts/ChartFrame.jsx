import { StyleSheet, View } from 'react-native'
import { Text } from '../../ui'
import { colors, radius } from '../../../theme'
import { SERIES } from './chartTheme'

// Title, legend and the plot area, as one object. A legend is present whenever there are two or
// more series (identity is never carried by colour alone); a single-series chart is named by its
// title and gets no legend box.
export function ChartFrame({ title, description, series = [], actions, height = 260, children }) {
  return (
    <View style={styles.frame}>
      {title || series.length > 1 || actions ? (
        <View style={styles.head}>
          <View style={{ minWidth: 0, flexShrink: 1 }}>
            {title ? <Text style={styles.title}>{title}</Text> : null}
            {description ? <Text style={styles.desc}>{description}</Text> : null}
          </View>

          {series.length > 1 || actions ? (
            <View style={styles.headRight}>
              {series.length > 1 ? <ChartLegend series={series} /> : null}
              {actions}
            </View>
          ) : null}
        </View>
      ) : null}
      <View style={[styles.body, { height }]}>{children}</View>
    </View>
  )
}

export function ChartLegend({ series = [] }) {
  return (
    <View style={styles.legend}>
      {series.map((item, index) => (
        <View key={item.key} style={styles.legendItem}>
          <View style={[styles.swatch, { backgroundColor: item.color || SERIES[index] }]} />
          <Text style={styles.legendText}>{item.label}</Text>
        </View>
      ))}
    </View>
  )
}

// One tooltip for every chart type. `payload` is [{ key, name, color, value }]; values are
// formatted by the caller. Rendered by the chart when a point is tapped.
export function ChartTooltip({ payload, label, formatValue = (value) => value, total, style }) {
  if (!payload?.length) return null

  const sum = payload.reduce((accumulator, entry) => accumulator + (entry.value || 0), 0)

  return (
    <View pointerEvents="none" style={[styles.tip, style]}>
      <Text style={styles.tipLabel}>{String(label ?? '').toUpperCase()}</Text>
      <View style={{ marginTop: 6, gap: 4 }}>
        {payload.map((entry) => (
          <View key={entry.key} style={styles.tipRow}>
            <View style={[styles.tipSwatch, { backgroundColor: entry.color }]} />
            <Text style={styles.tipName}>{entry.name}</Text>
            <Text noTranslate style={styles.tipValue}>
              {String(formatValue(entry.value))}
            </Text>
          </View>
        ))}
      </View>
      {total && payload.length > 1 ? (
        <View style={styles.tipTotal}>
          <Text style={styles.tipName}>Total</Text>
          <Text noTranslate style={styles.tipValue}>
            {String(formatValue(sum))}
          </Text>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  frame: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border.DEFAULT, backgroundColor: colors.surface.DEFAULT },
  head: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border.DEFAULT, paddingHorizontal: 16, paddingVertical: 12,
  },
  title: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: colors.slate[900] },
  desc: { marginTop: 2, fontSize: 12, lineHeight: 16, color: colors.ink.subtle },
  headRight: { flexShrink: 0, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 },
  body: { paddingHorizontal: 16, paddingBottom: 12, paddingTop: 16 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 16, rowGap: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { height: 10, width: 10, borderRadius: 2 },
  legendText: { fontSize: 12, lineHeight: 16, color: colors.ink.muted },
  tip: {
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border.DEFAULT, backgroundColor: colors.surface.DEFAULT,
    paddingHorizontal: 12, paddingVertical: 8, minWidth: 140, elevation: 6,
    shadowColor: '#0f172a', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 24,
  },
  tipLabel: { fontSize: 11, lineHeight: 16, fontWeight: '600', letterSpacing: 0.5, color: colors.ink.faint },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tipSwatch: { height: 8, width: 8, borderRadius: 2 },
  tipName: { fontSize: 12, lineHeight: 16, color: colors.ink.muted },
  tipValue: { marginLeft: 'auto', fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.slate[900], fontVariant: ['tabular-nums'] },
  tipTotal: {
    marginTop: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    borderTopWidth: 1, borderTopColor: colors.border.subtle, paddingTop: 6,
  },
})
