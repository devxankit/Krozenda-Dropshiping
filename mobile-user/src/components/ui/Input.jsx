import { forwardRef, useState } from 'react'
import { TextInput, View, StyleSheet } from 'react-native'
import { colors, fontFamilyFor, radius, shadows } from '../../theme'
import { Text } from './Text'
import { Icon } from './Icon'
import { useT } from '../../lib/i18n'

// Port of components/ui/Input.jsx + fieldStyles: label, helper/error line, focus ring, prefix icon,
// suffix. Works with react-hook-form's Controller.
export const Input = forwardRef(function Input(
  { label, error, description, size = 'md', icon, suffix, required, containerStyle, style, placeholder, ...props },
  ref,
) {
  const [focused, setFocused] = useState(false)
  const t = useT()
  const height = size === 'sm' ? 32 : size === 'control' ? 36 : 40
  return (
    <View style={[{ gap: 6 }, containerStyle]}>
      {label ? (
        <Text style={styles.label}>
          {label}
          {required ? (
            <Text noTranslate style={{ color: colors.danger[700] }}>
              {' *'}
            </Text>
          ) : null}
        </Text>
      ) : null}
      <View
        style={[
          styles.field,
          shadows.xs,
          { height, borderColor: error ? colors.danger[500] : focused ? colors.brand[500] : colors.border.DEFAULT },
        ]}
      >
        {icon ? <Icon name={icon} size={16} color={colors.ink.faint} style={{ marginRight: 8 }} /> : null}
        <TextInput
          ref={ref}
          placeholderTextColor={colors.ink.faint}
          placeholder={placeholder ? t(placeholder) : undefined}
          style={[styles.input, { fontFamily: fontFamilyFor('400'), fontSize: size === 'sm' ? 12 : 14 }, style]}
          {...props}
          onFocus={(e) => {
            setFocused(true)
            props.onFocus?.(e)
          }}
          onBlur={(e) => {
            setFocused(false)
            props.onBlur?.(e)
          }}
        />
        {suffix ? <Text style={{ fontSize: 12, fontWeight: '500', color: colors.ink.faint }}>{suffix}</Text> : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : description ? <Text style={styles.desc}>{description}</Text> : null}
    </View>
  )
})

const styles = StyleSheet.create({
  label: { fontSize: 14, fontWeight: '500', color: colors.slate[700] },
  field: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: radius.md, backgroundColor: '#fff', paddingHorizontal: 12 },
  input: { flex: 1, color: colors.slate[900], paddingVertical: 0 },
  error: { fontSize: 12, color: colors.danger[700] },
  desc: { fontSize: 12, color: colors.ink.subtle, lineHeight: 16 },
})
