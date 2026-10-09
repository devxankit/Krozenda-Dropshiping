import { View, StyleSheet } from 'react-native'
import { colors } from '../../theme'
import { Text } from './Text'

// Port of components/ui/Badge.jsx. tone: neutral | brand | accent | success | warning | danger;
// size: sm | md. `ring-1 ring-inset` is a 1px border in the tone colour at 15-20% alpha.
const TONES = {
  neutral: { bg: colors.surface.muted, fg: colors.slate[700], ring: 'rgba(100,116,139,0.15)', dot: colors.ink.faint },
  brand: { bg: colors.brand[50], fg: colors.brand[700], ring: 'rgba(37,99,235,0.15)', dot: colors.brand[600] },
  accent: { bg: colors.accent[50], fg: colors.accent[700], ring: 'rgba(124,58,237,0.15)', dot: colors.accent[600] },
  success: { bg: colors.success[50], fg: colors.success[700], ring: 'rgba(21,128,61,0.15)', dot: colors.success[500] },
  warning: { bg: colors.warning[50], fg: colors.warning[700], ring: 'rgba(180,83,9,0.2)', dot: colors.warning[500] },
  danger: { bg: colors.danger[50], fg: colors.danger[700], ring: 'rgba(185,28,28,0.15)', dot: colors.danger[500] },
}

export function Badge({ tone = 'neutral', size = 'md', dot = false, children, style, textStyle }) {
  const t = TONES[tone] || TONES.neutral
  const sm = size === 'sm'
  return (
    <View
      style={[
        styles.base,
        sm ? { height: 20, paddingHorizontal: 8 } : { paddingHorizontal: 10, paddingVertical: 2 },
        { backgroundColor: t.bg, borderColor: t.ring },
        style,
      ]}
    >
      {dot ? <View style={[styles.dot, { backgroundColor: t.dot }]} /> : null}
      {typeof children === 'string' || typeof children === 'number' ? (
        <Text numberOfLines={1} style={[{ fontSize: sm ? 11 : 12, lineHeight: 16, fontWeight: '500', color: t.fg }, textStyle]}>
          {children}
        </Text>
      ) : (
        children
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  base: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, borderRadius: 9999, borderWidth: 1 },
  dot: { width: 6, height: 6, borderRadius: 3 },
})
