import { forwardRef, useState } from 'react'
import { TextInput, View, StyleSheet } from 'react-native'
import { colors, fontFamilyFor } from '../../theme'
import { FieldHint, FieldLabel, emitChange, fieldBox, ringColor } from './fieldStyles'
import { useT } from '../../lib/i18n'

// Port of components/ui/Textarea.jsx (rows default 4; text-sm leading-relaxed).
export const Textarea = forwardRef(function Textarea(
  { label, error, description, rows = 4, required, disabled, containerStyle, style, placeholder, value, onChange, onChangeText, ...props },
  ref,
) {
  const [focused, setFocused] = useState(false)
  const t = useT()
  const text = value === undefined || value === null ? undefined : String(value)
  return (
    <View style={[{ gap: 6 }, containerStyle]}>
      {label ? <FieldLabel required={required}>{label}</FieldLabel> : null}
      <View style={[styles.ring, focused && { borderColor: ringColor(error) }]}>
        <View style={[...fieldBox({ error, focused, disabled }), { paddingVertical: 8, alignItems: 'flex-start', minHeight: rows * 22 + 18 }]}>
          <TextInput
            ref={ref}
            multiline
            placeholderTextColor={colors.ink.faint}
            placeholder={placeholder ? t(placeholder) : undefined}
            value={text}
            editable={!disabled}
            style={[
              { flex: 1, padding: 0, minHeight: rows * 22, fontSize: 14, lineHeight: 22, textAlignVertical: 'top', fontFamily: fontFamilyFor('400'), color: disabled ? colors.ink.faint : colors.slate[900] },
              style,
            ]}
            {...props}
            onChangeText={(v) => emitChange({ onChange, onChangeText }, v)}
            onFocus={(e) => {
              setFocused(true)
              props.onFocus?.(e)
            }}
            onBlur={(e) => {
              setFocused(false)
              props.onBlur?.(e)
            }}
          />
        </View>
      </View>
      <FieldHint error={error} description={description} />
    </View>
  )
})

const styles = StyleSheet.create({
  ring: { borderWidth: 3, borderColor: 'transparent', borderRadius: 11, margin: -3 },
})
