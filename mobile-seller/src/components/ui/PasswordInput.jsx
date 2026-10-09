import { forwardRef, useState } from 'react'
import { Pressable, TextInput, View, StyleSheet } from 'react-native'
import { colors, fontFamilyFor, radius } from '../../theme'
import { Text } from './Text'
import { Icon } from './Icon'
import { FIELD_HEIGHT, emitChange } from './fieldStyles'
import { useT } from '../../lib/i18n'

// Port of components/ui/PasswordInput.jsx: same field as Input plus a visibility toggle.
export const PasswordInput = forwardRef(function PasswordInput(
  { label, error, description, size = 'md', icon, required, disabled, containerStyle, style, placeholder, value, onChange, onChangeText, ...props },
  ref,
) {
  const [visible, setVisible] = useState(false)
  const [focused, setFocused] = useState(false)
  const t = useT()
  const text = value === undefined || value === null ? undefined : String(value)
  return (
    <View style={[{ gap: 4 }, containerStyle]}>
      {label ? (
        <View style={styles.labelRow}>
          <Text style={styles.label}>{label}</Text>
          {required ? (
            <Text noTranslate style={{ fontSize: 14, color: colors.danger[700] }}>
              *
            </Text>
          ) : null}
        </View>
      ) : null}
      <View
        style={[
          styles.field,
          {
            height: FIELD_HEIGHT[size] || 40,
            borderColor: error ? colors.danger[500] : focused ? colors.brand[500] : colors.border.DEFAULT,
            borderWidth: focused ? 2 : 1,
            backgroundColor: disabled ? colors.surface.muted : '#fff',
          },
        ]}
      >
        {icon ? <Icon name={icon} size={16} color={colors.ink.faint} style={{ marginRight: 8 }} /> : null}
        <TextInput
          ref={ref}
          secureTextEntry={!visible}
          autoCapitalize="none"
          autoCorrect={false}
          placeholderTextColor={colors.ink.faint}
          placeholder={placeholder ? t(placeholder) : undefined}
          value={text}
          editable={!disabled}
          style={[
            { flex: 1, padding: 0, fontSize: size === 'sm' ? 12 : 14, fontFamily: fontFamilyFor('400'), color: disabled ? colors.ink.faint : colors.slate[900] },
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
        <Pressable onPress={() => setVisible((v) => !v)} hitSlop={8} accessibilityLabel={visible ? 'Hide password' : 'Show password'} style={styles.toggle}>
          <Icon name={visible ? 'hide' : 'show'} size={16} color={colors.ink.faint} />
        </Pressable>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : description ? <Text style={styles.desc}>{description}</Text> : null}
    </View>
  )
})

const styles = StyleSheet.create({
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '500', color: colors.slate[700] },
  field: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.md, paddingLeft: 12, paddingRight: 8 },
  toggle: { padding: 4, marginLeft: 4 },
  error: { fontSize: 12, lineHeight: 16, color: colors.danger[700] },
  desc: { fontSize: 12, lineHeight: 16, color: colors.ink.faint },
})
