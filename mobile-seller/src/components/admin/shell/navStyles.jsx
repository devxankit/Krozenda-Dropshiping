import { StyleSheet, View } from 'react-native'
import { Text } from '../../ui'
import { colors, radius, sp } from '../../../theme'

// Native equivalents of the web's class-string helpers. `navItemStyle` returns a style object
// (instead of the web's Tailwind string) for the seller drawer rows (40px touch rows).
export const NAV_BADGE_TONE = Object.freeze({
  warning: { bg: colors.warning[50], fg: colors.warning[700], border: colors.warning[700] + '33' },
  danger: { bg: colors.danger[50], fg: colors.danger[700], border: colors.danger[700] + '26' },
  brand: { bg: colors.brand[100], fg: colors.brand[700], border: 'transparent' },
})

// size: 'desktop' (36px rows) | 'touch' (40px rows)
export function navItemStyle({ active = false, muted = false, collapsed = false, size = 'desktop' } = {}) {
  let backgroundColor = 'transparent'
  let color = colors.ink.muted
  let fontWeight = '500'
  let opacity = 1
  if (active && muted) {
    backgroundColor = colors.surface.sunken
    color = colors.ink.subtle
    fontWeight = '600'
  } else if (active) {
    backgroundColor = colors.brand[50]
    color = colors.brand[700]
    fontWeight = '600'
  } else if (muted) {
    color = colors.ink.faint
    opacity = 0.7
  }
  return {
    row: {
      height: size === 'touch' ? 40 : 36,
      flexDirection: 'row',
      alignItems: 'center',
      gap: sp(3),
      borderRadius: radius.md,
      paddingHorizontal: collapsed ? 0 : sp(2.5),
      width: collapsed ? 40 : undefined,
      justifyContent: collapsed ? 'center' : undefined,
      backgroundColor,
      opacity,
    },
    text: { fontSize: 14, lineHeight: 20, fontWeight, color },
    // 3px active bar on the inner edge
    bar: active && !muted && !collapsed
      ? { position: 'absolute', left: -sp(2.5), top: 6, bottom: 6, width: 3, borderTopRightRadius: 9999, borderBottomRightRadius: 9999, backgroundColor: colors.brand[600] }
      : null,
    iconColor: active ? colors.brand[600] : colors.ink.faint,
  }
}

export function navIconColor(active) {
  return active ? colors.brand[600] : colors.ink.faint
}

export function NavCount({ count, tone }) {
  const t = NAV_BADGE_TONE[tone] || NAV_BADGE_TONE.brand
  return (
    <View style={[styles.count, { backgroundColor: t.bg, borderColor: t.border }]}>
      <Text noTranslate style={[styles.countText, { color: t.fg }]}>
        {count > 99 ? '99+' : String(count)}
      </Text>
    </View>
  )
}

export function NavGroupLabel({ children, style }) {
  return <Text style={[styles.group, style]}>{typeof children === 'string' ? children.toUpperCase() : children}</Text>
}

// Wordmark used in the drawer header.
export function BrandMark({ label }) {
  return (
    <View style={styles.brandRow}>
      <View style={styles.brandTile}>
        <Text noTranslate style={styles.brandK}>K</Text>
      </View>
      <Text noTranslate style={styles.brandName}>Krozenda</Text>
      {label ? (
        <View style={styles.brandLabel}>
          <Text style={styles.brandLabelText}>{label}</Text>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  count: { marginLeft: 'auto', height: 20, minWidth: 20, alignItems: 'center', justifyContent: 'center', borderRadius: 9999, paddingHorizontal: 6, borderWidth: 1 },
  countText: { fontSize: 11, lineHeight: 16, fontWeight: '600', fontVariant: ['tabular-nums'] },
  group: { paddingHorizontal: sp(2.5), paddingBottom: 6, paddingTop: 16, fontSize: 11, lineHeight: 16, fontWeight: '600', letterSpacing: 0.55, color: colors.ink.faint },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 },
  brandTile: { height: 28, width: 28, alignItems: 'center', justifyContent: 'center', borderRadius: radius.lg, backgroundColor: colors.brand[600] },
  brandK: { fontSize: 14, fontWeight: '700', color: '#fff' },
  brandName: { fontSize: 15, fontWeight: '700', letterSpacing: -0.3, color: colors.slate[900] },
  brandLabel: { borderRadius: 4, backgroundColor: colors.surface.sunken, paddingHorizontal: 6, paddingVertical: 2 },
  brandLabelText: { fontSize: 10, fontWeight: '600', letterSpacing: 0.6, color: colors.ink.subtle },
})
