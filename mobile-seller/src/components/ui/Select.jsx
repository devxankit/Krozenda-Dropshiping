import { forwardRef, useState } from 'react'
import { Pressable, ScrollView, View, StyleSheet } from 'react-native'
import { colors } from '../../theme'
import { Text } from './Text'
import { Icon } from './Icon'
import { Sheet } from './Sheet'
import { FIELD_HEIGHT, FieldHint, FieldLabel, emitChange, fieldBox, ringColor } from './fieldStyles'

// Bottom-sheet list of options (native replacement for the browser's <select> popup).
export function OptionSheet({ visible, onClose, title, options, value, onSelect }) {
  return (
    <Sheet visible={visible} onClose={onClose} maxHeight="70%">
      {title ? (
        <View style={styles.sheetHead}>
          <Text style={styles.sheetTitle}>{title}</Text>
        </View>
      ) : null}
      <ScrollView keyboardShouldPersistTaps="handled" bounces={false}>
        {options.map((option) => {
          const selected = String(option.value) === String(value)
          return (
            <Pressable
              key={String(option.value)}
              onPress={() => onSelect(option)}
              disabled={option.disabled}
              style={({ pressed }) => [
                styles.row,
                selected && { backgroundColor: colors.brand[50] },
                pressed && { backgroundColor: colors.surface.muted },
                option.disabled && { opacity: 0.5 },
              ]}
            >
              <Text style={[styles.rowText, selected && { color: colors.brand[700], fontWeight: '600' }]}>{option.label}</Text>
              {selected ? <Icon name="check" size={16} color={colors.brand[600]} /> : null}
            </Pressable>
          )
        })}
      </ScrollView>
    </Sheet>
  )
}

// Port of components/ui/Select.jsx. options: [{ value, label }]. onChange gets { target: { value } }
// (value as a string, like a DOM <select>); onValueChange / onChangeText get the same string.
export const Select = forwardRef(function Select(
  { label, error, description, options = [], placeholder, size = 'md', required, disabled, value, containerStyle, style, ...props },
  ref,
) {
  const [open, setOpen] = useState(false)
  const current = options.find((o) => String(o.value) === String(value ?? ''))
  const showPlaceholder = !current
  const shown = current ? current.label : placeholder
  return (
    <View style={[{ gap: 6 }, containerStyle]}>
      {label ? <FieldLabel required={required}>{label}</FieldLabel> : null}
      <View style={[styles.ring, open && { borderColor: ringColor(error) }]}>
        <Pressable
          ref={ref}
          disabled={disabled}
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          style={[...fieldBox({ error, focused: open, disabled }), { height: FIELD_HEIGHT[size] || 40, paddingRight: 36 }, style]}
        >
          <Text
            numberOfLines={1}
            style={{ flex: 1, fontSize: size === 'sm' ? 12 : 14, color: showPlaceholder || disabled ? colors.ink.faint : colors.slate[900] }}
          >
            {shown || ' '}
          </Text>
          <View pointerEvents="none" style={styles.chevron}>
            <Icon name="chevronDown" size={16} color={colors.ink.faint} />
          </View>
        </Pressable>
      </View>
      <FieldHint error={error} description={description} />
      <OptionSheet
        visible={open}
        onClose={() => setOpen(false)}
        title={label || placeholder}
        options={options}
        value={value}
        onSelect={(option) => {
          setOpen(false)
          emitChange(props, String(option.value))
        }}
      />
    </View>
  )
})

const styles = StyleSheet.create({
  ring: { borderWidth: 3, borderColor: 'transparent', borderRadius: 11, margin: -3 },
  chevron: { position: 'absolute', right: 12 },
  sheetHead: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border.DEFAULT },
  sheetTitle: { fontSize: 16, fontWeight: '600', color: colors.slate[900] },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 20, minHeight: 48, paddingVertical: 10 },
  rowText: { flex: 1, fontSize: 14, color: colors.slate[800] },
})
