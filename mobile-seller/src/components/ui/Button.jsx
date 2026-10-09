import { useState } from 'react'
import { ActivityIndicator, StyleSheet } from 'react-native'
import { colors, radius, shadows } from '../../theme'
import { Text } from './Text'
import { Icon } from './Icon'
import { PressableScale } from './motion'

// Port of components/ui/Button.jsx. variants: primary | secondary | ghost | danger | dangerOutline
// | subtle | quiet. sizes: xs | sm | control | md | lg. `onClick` is accepted as an alias of `onPress`.
const VARIANTS = {
  primary: { bg: colors.brand[600], pressed: colors.brand[700], fg: '#fff', shadow: true },
  secondary: { bg: '#fff', pressed: colors.surface.muted, fg: colors.slate[900], border: colors.border.DEFAULT, shadow: true },
  ghost: { bg: 'transparent', pressed: colors.brand[50], fg: colors.brand[700] },
  danger: { bg: colors.danger[500], pressed: colors.danger[700], fg: '#fff', shadow: true },
  dangerOutline: { bg: '#fff', pressed: colors.danger[50], fg: colors.danger[700], border: colors.danger[200], shadow: true },
  subtle: { bg: colors.surface.muted, pressed: colors.surface.sunken, fg: colors.ink.muted },
  quiet: { bg: 'transparent', pressed: colors.surface.muted, fg: colors.ink.subtle },
}
const SIZES = {
  xs: { h: 28, px: 10, fs: 11 },
  sm: { h: 32, px: 12, fs: 12 },
  control: { h: 36, px: 12, fs: 14 },
  md: { h: 40, px: 16, fs: 14 },
  lg: { h: 48, px: 24, fs: 16 },
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  iconOnly = false,
  isLoading = false,
  disabled,
  onPress,
  onClick,
  children,
  style,
  textStyle,
  ...rest
}) {
  const v = VARIANTS[variant]
  const s = SIZES[size]
  const off = disabled || isLoading
  const [pressed, setPressed] = useState(false)
  return (
    <PressableScale
      {...rest}
      onPress={onPress || onClick}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      scaleTo={0.97}
      disabled={off}
      accessibilityRole="button"
      accessibilityState={{ busy: isLoading, disabled: off }}
      style={[
        styles.base,
        {
          height: s.h,
          paddingHorizontal: iconOnly ? 0 : s.px,
          width: iconOnly ? s.h : undefined,
          backgroundColor: pressed ? v.pressed : v.bg,
          borderWidth: v.border ? 1 : 0,
          borderColor: v.border,
          opacity: off ? 0.5 : 1,
        },
        v.shadow && shadows.xs,
        style,
      ]}
    >
      {isLoading ? <ActivityIndicator size="small" color={v.fg} /> : icon ? <Icon name={icon} size={14} color={v.fg} /> : null}
      {!iconOnly && children != null ? (
        <Text style={[{ fontSize: s.fs, fontWeight: '500', color: v.fg }, textStyle]}>{children}</Text>
      ) : null}
      {iconRight && !isLoading ? <Icon name={iconRight} size={14} color={v.fg} /> : null}
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  base: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: radius.md },
})
