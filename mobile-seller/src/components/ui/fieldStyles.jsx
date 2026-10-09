import { View, StyleSheet } from 'react-native'
import { colors, radius, shadows } from '../../theme'
import { Text } from './Text'
import { Icon } from './Icon'

// Port of fieldStyles.jsx: one look for every text-like control (Input, Select, Textarea).

export const FIELD_HEIGHT = Object.freeze({ sm: 32, control: 36, md: 40 })

// Tailwind `ring-4 ring-<c>/15` drawn as a translucent outer border around the field.
export const ringColor = (error) => (error ? 'rgba(239,68,68,0.15)' : 'rgba(59,130,246,0.15)')

export function fieldBorderColor({ error, focused }) {
  if (error) return colors.danger[500]
  return focused ? colors.brand[500] : colors.border.DEFAULT
}

export const fieldBox = (state) => [
  styles.field,
  shadows.xs,
  { borderColor: fieldBorderColor(state) },
  state.disabled && styles.disabled,
]

// onChange(event-like) + onChangeText(value) convention shared by all form controls.
export function emitChange(props, value, checked) {
  const target = { value, checked, type: props.type }
  props.onChange?.({ target, currentTarget: target, persist() {} })
  props.onChangeText?.(value)
  props.onValueChange?.(value)
}

export function FieldLabel({ required, children }) {
  return (
    <View style={styles.labelRow}>
      <Text style={styles.label}>{children}</Text>
      {required ? (
        <Text noTranslate style={styles.star}>
          *
        </Text>
      ) : null}
    </View>
  )
}

export function FieldHint({ error, description }) {
  if (error) {
    return (
      <View style={styles.errorRow}>
        <Icon name="danger" size={14} color={colors.danger[700]} style={{ marginTop: 1 }} />
        <Text style={styles.error}>{error}</Text>
      </View>
    )
  }
  if (!description) return null
  return <Text style={styles.desc}>{description}</Text>
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.md,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
  },
  disabled: { backgroundColor: colors.surface.muted, ...shadows.none },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '500', color: colors.slate[700] },
  star: { fontSize: 14, color: colors.danger[700] },
  errorRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 4 },
  error: { flex: 1, fontSize: 12, lineHeight: 16, color: colors.danger[700] },
  desc: { fontSize: 12, lineHeight: 16, color: colors.ink.subtle },
})
