import { forwardRef, useState } from 'react'
import { TextInput, View, StyleSheet } from 'react-native'
import { colors, fontFamilyFor } from '../../theme'
import { Text } from './Text'
import { Icon } from './Icon'
import { FIELD_HEIGHT, FieldHint, FieldLabel, emitChange, fieldBox, ringColor } from './fieldStyles'
import { useT } from '../../lib/i18n'

// Port of components/ui/Input.jsx. Accepts the web's `type` (text | number | tel | email | password |
// url) plus RN props; onChange receives { target: { value } } AND onChangeText receives the string.
const TYPE_PROPS = {
  number: { keyboardType: 'decimal-pad' },
  tel: { keyboardType: 'phone-pad' },
  email: { keyboardType: 'email-address', autoCapitalize: 'none', autoCorrect: false },
  url: { keyboardType: 'url', autoCapitalize: 'none', autoCorrect: false },
  password: { secureTextEntry: true, autoCapitalize: 'none', autoCorrect: false },
}

export const Input = forwardRef(function Input(
  {
    label,
    error,
    description,
    size = 'md',
    icon,
    suffix,
    required,
    disabled,
    multiline,
    containerStyle,
    style,
    placeholder,
    value,
    type,
    onChange,
    onChangeText,
    ...props
  },
  ref,
) {
  const [focused, setFocused] = useState(false)
  const t = useT()
  const height = FIELD_HEIGHT[size] || 40
  const text = value === undefined || value === null ? undefined : String(value)
  return (
    <View style={[{ gap: 6 }, containerStyle]}>
      {label ? <FieldLabel required={required}>{label}</FieldLabel> : null}
      <View style={[styles.ring, focused && { borderColor: ringColor(error) }]}>
        <View
          style={[
            ...fieldBox({ error, focused, disabled }),
            multiline ? { minHeight: height, paddingVertical: 8, alignItems: 'flex-start' } : { height },
          ]}
        >
          {icon ? <Icon name={icon} size={16} color={colors.ink.faint} style={{ marginRight: 8 }} /> : null}
          <TextInput
            ref={ref}
            placeholderTextColor={colors.ink.faint}
            placeholder={placeholder ? t(placeholder) : undefined}
            value={text}
            multiline={multiline}
            editable={!disabled && props.editable !== false}
            style={[
              styles.input,
              {
                fontFamily: fontFamilyFor('400'),
                fontSize: size === 'sm' ? 12 : 14,
                color: disabled ? colors.ink.faint : colors.slate[900],
              },
              multiline && { textAlignVertical: 'top' },
              style,
            ]}
            {...TYPE_PROPS[type]}
            {...props}
            onChangeText={(v) => emitChange({ onChange, onChangeText, type }, v)}
            onFocus={(e) => {
              setFocused(true)
              props.onFocus?.(e)
            }}
            onBlur={(e) => {
              setFocused(false)
              props.onBlur?.(e)
            }}
          />
          {suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}
        </View>
      </View>
      <FieldHint error={error} description={description} />
    </View>
  )
})

const styles = StyleSheet.create({
  ring: { borderWidth: 3, borderColor: 'transparent', borderRadius: 11, margin: -3 },
  input: { flex: 1, paddingVertical: 0 },
  suffix: { fontSize: 12, fontWeight: '500', color: colors.ink.faint, marginLeft: 8 },
})
