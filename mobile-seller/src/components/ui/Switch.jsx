import { Pressable, View, StyleSheet } from 'react-native'
import { colors, shadows } from '../../theme'
import { Text } from './Text'

// Port of components/ui/Switch.jsx. onChange gets { target: { checked } }; onValueChange(bool) too.
export function Switch({ checked = false, disabled = false, label, description, style, onChange, onValueChange }) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={() => {
        const next = !checked
        onChange?.({ target: { checked: next, value: next }, currentTarget: { checked: next, value: next } })
        onValueChange?.(next)
      }}
      style={[styles.wrap, disabled && { opacity: 0.5 }, style]}
    >
      <View style={[styles.track, { backgroundColor: checked ? colors.brand[600] : colors.border.strong, alignItems: checked ? 'flex-end' : 'flex-start' }]}>
        <View style={[styles.thumb, shadows.card]} />
      </View>
      {label || description ? (
        <View style={styles.text}>
          {label ? <Text style={styles.label}>{label}</Text> : null}
          {description ? <Text style={styles.desc}>{description}</Text> : null}
        </View>
      ) : null}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  track: { width: 36, height: 20, borderRadius: 10, padding: 2, justifyContent: 'center' },
  thumb: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#fff' },
  text: { gap: 2, flexShrink: 1 },
  label: { fontSize: 14, lineHeight: 18, fontWeight: '500', color: colors.slate[800] },
  desc: { fontSize: 12, lineHeight: 16, color: colors.ink.faint },
})
