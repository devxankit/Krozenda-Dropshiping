import { Pressable, View, StyleSheet } from 'react-native'
import { colors } from '../../theme'
import { Text } from './Text'
import { Icon } from './Icon'

// Port of components/ui/Checkbox.jsx. onChange gets { target: { checked } }; onValueChange(bool) too.
export function Checkbox({ label, description, checked = false, indeterminate = false, disabled = false, style, onChange, onValueChange }) {
  const isOn = checked || indeterminate
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: indeterminate ? 'mixed' : checked, disabled }}
      disabled={disabled}
      hitSlop={6}
      onPress={() => {
        const next = !checked
        onChange?.({ target: { checked: next, value: next }, currentTarget: { checked: next, value: next } })
        onValueChange?.(next)
      }}
      style={[styles.wrap, disabled && { opacity: 0.5 }, style]}
    >
      <View style={[styles.box, isOn ? styles.on : styles.off]}>
        {indeterminate ? <Icon name="remove" size={12} color="#fff" /> : checked ? <Icon name="check" size={12} color="#fff" /> : null}
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
  wrap: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, alignSelf: 'flex-start' },
  box: { width: 16, height: 16, borderRadius: 4, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  on: { backgroundColor: colors.brand[600], borderColor: colors.brand[600] },
  off: { backgroundColor: '#fff', borderColor: colors.border.strong },
  text: { gap: 2, flexShrink: 1 },
  label: { fontSize: 14, lineHeight: 18, color: colors.slate[800] },
  desc: { fontSize: 12, lineHeight: 16, color: colors.ink.faint },
})
