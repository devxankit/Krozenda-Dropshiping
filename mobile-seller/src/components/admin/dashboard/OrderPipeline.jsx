import { StyleSheet, View } from 'react-native'
import { Text } from '../../ui'
import { SectionCard } from '../display'
import { NoData } from '../feedback'
import { colors } from '../../../theme'

const EXCEPTION_DOT = Object.freeze({
  danger: colors.danger[500],
  warning: colors.warning[500],
  neutral: colors.ink.faint,
})

// The lifecycle as a funnel. Single series, single hue - magnitude, not identity. Bars are scaled
// against the busiest stage; the percentage beside each one is its share of every order in the
// window.
export function OrderPipeline({ pipeline = [], exceptions = [] }) {
  const peak = Math.max(1, ...pipeline.map((stage) => stage.count))
  const total = pipeline.reduce((sum, stage) => sum + stage.count, 0)
  const visibleExceptions = exceptions.filter((exception) => exception.count > 0)

  return (
    <SectionCard title="Order pipeline" description="Orders by lifecycle stage">
      <View style={styles.body}>
        {total === 0 ? (
          <View style={{ minHeight: 96 }}>
            <NoData message="No orders in this window" hint="Pick a longer range to see the funnel." />
          </View>
        ) : (
          pipeline.map((stage) => (
            <View key={stage.status} style={styles.stageRow}>
              <Text numberOfLines={1} style={styles.stageLabel}>
                {stage.label}
              </Text>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${Math.max(2, (stage.count / peak) * 100)}%` }]} />
              </View>
              <View style={styles.stageNums}>
                <Text noTranslate style={styles.count}>
                  {stage.count.toLocaleString('en-IN')}
                </Text>
                <Text noTranslate style={styles.pct}>
                  {`${Math.round((stage.count / total) * 100)}%`}
                </Text>
              </View>
            </View>
          ))
        )}

        <View style={styles.exceptions}>
          <Text style={styles.exTitle}>EXCEPTION BRANCHES</Text>
          {visibleExceptions.length === 0 ? (
            <Text style={styles.exNone}>Nothing cancelled, returned or refunded in this window.</Text>
          ) : (
            <View style={styles.exRow}>
              {visibleExceptions.map((exception) => (
                <View key={exception.label} style={styles.exItem}>
                  <View style={[styles.dot, { backgroundColor: EXCEPTION_DOT[exception.tone] || EXCEPTION_DOT.neutral }]} />
                  <Text style={styles.exLabel}>{exception.label}</Text>
                  <Text noTranslate style={styles.exCount}>
                    {String(exception.count)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    </SectionCard>
  )
}

const styles = StyleSheet.create({
  body: { gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  stageRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stageLabel: { width: 96, fontSize: 12, lineHeight: 16, color: colors.ink.muted },
  track: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.surface.sunken },
  fill: { height: 8, borderRadius: 4, backgroundColor: colors.brand[600] },
  stageNums: { width: 72, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'flex-end', gap: 6 },
  count: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.slate[800], fontVariant: ['tabular-nums'] },
  pct: { fontSize: 11, lineHeight: 16, color: colors.ink.faint, fontVariant: ['tabular-nums'] },
  exceptions: { marginTop: 4, borderTopWidth: 1, borderTopColor: colors.border.subtle, paddingTop: 12 },
  exTitle: { fontSize: 11, lineHeight: 16, fontWeight: '600', letterSpacing: 0.55, color: colors.ink.faint },
  exNone: { marginTop: 8, fontSize: 12, lineHeight: 16, color: colors.ink.subtle },
  exRow: { marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 6 },
  exItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { height: 6, width: 6, borderRadius: 3 },
  exLabel: { fontSize: 12, lineHeight: 16, color: colors.ink.muted },
  exCount: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.slate[900], fontVariant: ['tabular-nums'] },
})
