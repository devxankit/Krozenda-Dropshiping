import { forwardRef, useState } from 'react'
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native'
import { Icon } from '../../../../components/ui/Icon'
import { Text } from '../../../../components/ui/Text'
import { OptionSheet } from '../../../../components/ui/Select'
import { colors, fontFamilyFor } from '../../../../theme'
import { useT } from '../../../../lib/i18n'

// Local building blocks for the seller sign-in / sign-up screens. The web pages style raw <input>s
// (text-xs, rounded-xl, slate-300 border, brand focus ring) rather than the shared Input, so these
// reproduce that look: 12px text, 12px radius, 4px brand-50 focus ring.
const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' })

export function AuthLabel({ children, required, small, style }) {
  return (
    <Text style={[small ? styles.labelSm : styles.label, style]}>
      {children}
      {required ? (
        <Text noTranslate style={{ color: colors.danger[500] }}>
          {' *'}
        </Text>
      ) : null}
    </Text>
  )
}

export function AuthError({ children, small }) {
  if (!children) return null
  return <Text style={small ? styles.errSm : styles.err}>{children}</Text>
}

// icon: left icon (login). secure: password field with show/hide toggle. mono/bold: font-mono variants.
// compact: py-2 (sign-up) instead of py-2.5 (sign-in). tight: the smaller rounded-lg / 11px label variant.
export const AuthInput = forwardRef(function AuthInput(
  { label, required, icon, error, secure, mono, bold, compact, tight, onChangeText, style, containerStyle, placeholder, ...props },
  ref,
) {
  const t = useT()
  const [focused, setFocused] = useState(false)
  const [visible, setVisible] = useState(false)
  const weight = bold ? '700' : mono ? '600' : '500'
  return (
    <View style={containerStyle}>
      {label ? (
        <AuthLabel required={required} small={tight}>
          {label}
        </AuthLabel>
      ) : null}
      <View style={[styles.ring, focused && { borderColor: colors.brand[50] }]}>
        <View
          style={[
            styles.box,
            {
              paddingVertical: compact ? 8 : 10,
              borderRadius: tight ? 8 : 12,
              borderColor: error ? colors.danger[500] : focused ? colors.brand[600] : colors.slate[300],
            },
          ]}
        >
          {icon ? <Icon name={icon} size={16} color={colors.slate[400]} style={styles.leftIcon} /> : null}
          <TextInput
            ref={ref}
            placeholder={placeholder ? t(placeholder) : undefined}
            placeholderTextColor={colors.slate[400]}
            secureTextEntry={secure ? !visible : false}
            autoCorrect={false}
            onChangeText={onChangeText}
            onFocus={(e) => {
              setFocused(true)
              props.onFocus?.(e)
            }}
            onBlur={(e) => {
              setFocused(false)
              props.onBlur?.(e)
            }}
            {...props}
            style={[
              styles.input,
              {
                fontFamily: mono ? MONO : fontFamilyFor(weight),
                fontWeight: mono ? weight : undefined,
                paddingLeft: icon ? 40 : tight ? 12 : 14,
                paddingRight: secure ? 40 : tight ? 12 : 14,
              },
              style,
            ]}
          />
          {secure ? (
            <Pressable
              onPress={() => setVisible((v) => !v)}
              hitSlop={8}
              accessibilityLabel={visible ? 'Hide password' : 'Show password'}
              style={styles.eye}
            >
              <Icon name={visible ? 'HiEyeSlash' : 'HiEye'} size={16} color={colors.slate[400]} />
            </Pressable>
          ) : null}
        </View>
      </View>
      <AuthError small={tight}>{error}</AuthError>
    </View>
  )
})

// Web <select> replacement: same box as the inputs, opens the shared option sheet.
export function AuthSelect({ label, required, error, value, onChange, options, placeholder, hint }) {
  const [open, setOpen] = useState(false)
  const current = options.find((o) => String(o.value) === String(value ?? ''))
  return (
    <View>
      {label ? <AuthLabel required={required}>{label}</AuthLabel> : null}
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        style={[styles.box, styles.selectBox, { borderColor: error ? colors.danger[500] : colors.slate[300] }]}
      >
        <Text numberOfLines={1} style={[styles.selectText, !current && { color: colors.slate[400] }]}>
          {current ? current.label : placeholder || ' '}
        </Text>
        <Icon name="chevronDown" size={16} color={colors.slate[400]} />
      </Pressable>
      <AuthError>{error}</AuthError>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      <OptionSheet
        visible={open}
        onClose={() => setOpen(false)}
        title={label}
        options={options}
        value={value}
        onSelect={(o) => {
          setOpen(false)
          onChange(String(o.value))
        }}
      />
    </View>
  )
}

// Web action button: py-2.5 rounded-xl, text-xs bold. variant: primary | success | outline.
const BTN = {
  primary: { bg: colors.brand[600], pressed: colors.brand[700], fg: '#fff' },
  success: { bg: colors.success[600], pressed: colors.success[700], fg: '#fff' },
  outline: { bg: '#fff', pressed: colors.slate[50], fg: colors.slate[700], border: colors.slate[200] },
}
export function AuthButton({ variant = 'primary', children, onPress, disabled, icon, iconRight, style, px = 16 }) {
  const v = BTN[variant]
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: pressed ? v.pressed : v.bg, paddingHorizontal: px, opacity: disabled ? 0.6 : 1 },
        v.border && { borderWidth: 1, borderColor: v.border },
        style,
      ]}
    >
      {icon ? <Icon name={icon} size={14} color={v.fg} /> : null}
      <Text style={{ fontSize: 12, lineHeight: 16, fontWeight: '700', color: v.fg }}>{children}</Text>
      {iconRight ? <Icon name={iconRight} size={14} color={v.fg} /> : null}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 12 },
  label: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.slate[700], marginBottom: 4 },
  labelSm: { fontSize: 11, lineHeight: 16, fontWeight: '600', color: colors.slate[600], marginBottom: 4 },
  err: { marginTop: 4, fontSize: 11, lineHeight: 16, color: colors.danger[500] },
  errSm: { marginTop: 2, fontSize: 10, lineHeight: 14, color: colors.danger[500] },
  hint: { marginTop: 4, fontSize: 11, lineHeight: 16, color: colors.slate[500] },
  ring: { borderWidth: 4, borderColor: 'transparent', borderRadius: 16, margin: -4 },
  box: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, backgroundColor: '#fff' },
  input: { flex: 1, padding: 0, fontSize: 12, color: colors.slate[900] },
  leftIcon: { position: 'absolute', left: 14 },
  eye: { position: 'absolute', right: 12, padding: 4 },
  selectBox: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, gap: 8 },
  selectText: { flex: 1, fontSize: 12, fontWeight: '500', color: colors.slate[900] },
})
