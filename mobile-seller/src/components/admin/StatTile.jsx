import { StyleSheet, View } from 'react-native'
import { Icon, Text } from '../ui'
import { colors, radius, shadows } from '../../theme'

const DELTA_TONE = Object.freeze({
  up: { bg: colors.success[50], fg: colors.success[700] },
  down: { bg: colors.danger[50], fg: colors.danger[700] },
  flat: { bg: colors.surface.muted, fg: colors.ink.subtle },
})

function formatValue(value) {
  return typeof value === 'number' ? value.toLocaleString('en-IN') : value
}

// delta: { direction: 'up' | 'down' | 'flat', label: '12.4%' }
// icon: optional Icon name, shown in a tile opposite the label
export function StatTile({ label, value, delta, caption, tone = 'default', icon }) {
  const emphasised = tone === 'brand'
  const d = delta ? DELTA_TONE[delta.direction] : null

  return (
    <View
      style={[
        styles.tile,
        emphasised
          ? { borderColor: colors.brand[200], backgroundColor: colors.brand[50] + '66' }
          : { borderColor: colors.border.DEFAULT, backgroundColor: colors.surface.DEFAULT },
      ]}
    >
      <View style={styles.top}>
        <Text style={[styles.label, { color: emphasised ? colors.brand[600] : colors.ink.subtle }]}>
          {typeof label === 'string' ? label.toUpperCase() : label}
        </Text>
        {icon ? (
          <View style={[styles.iconTile, { backgroundColor: emphasised ? colors.brand[600] : colors.surface.sunken }]}>
            <Icon name={icon} size={14} color={emphasised ? '#fff' : colors.ink.muted} />
          </View>
        ) : null}
      </View>
      <Text noTranslate style={[styles.value, { color: emphasised ? colors.brand[700] : colors.slate[900] }]}>
        {String(formatValue(value))}
      </Text>
      {delta || caption ? (
        <View style={styles.bottom}>
          {delta ? (
            <View style={[styles.delta, { backgroundColor: d.bg }]}>
              {delta.direction !== 'flat' ? (
                <Icon name={delta.direction === 'up' ? 'arrowUp' : 'arrowDown'} size={12} color={d.fg} />
              ) : null}
              <Text noTranslate style={{ fontSize: 11, lineHeight: 16, fontWeight: '600', color: d.fg }}>
                {delta.label}
              </Text>
            </View>
          ) : null}
          {caption ? (
            <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 10, lineHeight: 16, color: colors.ink.faint }}>
              {caption}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  tile: { minWidth: 0, borderRadius: radius.xl, borderWidth: 1, padding: 12, ...shadows.xs },
  top: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  label: { flexShrink: 1, minWidth: 0, paddingTop: 2, fontSize: 10, lineHeight: 14, fontWeight: '600', letterSpacing: 0.5 },
  iconTile: { height: 28, width: 28, alignItems: 'center', justifyContent: 'center', borderRadius: radius.lg },
  value: { marginTop: 6, fontSize: 18, lineHeight: 28, fontWeight: '700', letterSpacing: -0.3, fontVariant: ['tabular-nums'] },
  bottom: { marginTop: 6, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  delta: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 9999, paddingHorizontal: 8, paddingVertical: 2 },
})
