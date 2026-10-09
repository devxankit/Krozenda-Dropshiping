import { Image } from 'expo-image'
import { View, StyleSheet } from 'react-native'
import { colors, shadows } from '../../theme'
import { Text } from './Text'
import { resolveImageSource } from './SmartImage'

// Port of components/ui/Avatar.jsx. size: xs 28 | sm 36 | md 44 | lg 56 | xl 72; shape: circle | square.
const SIZES = { xs: [28, 11], sm: [36, 12], md: [44, 14], lg: [56, 16], xl: [72, 18] }

function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function Avatar({ name = '', src, size = 'md', shape = 'circle', tone = 'brand', style }) {
  const [px, fs] = SIZES[size] || SIZES.md
  const base = { width: px, height: px, borderRadius: shape === 'circle' ? px / 2 : 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }
  if (src) {
    return (
      <View style={[base, shadows.sm, { borderWidth: 2, borderColor: colors.slate[100], backgroundColor: '#fff' }, style]} accessibilityLabel={name || undefined}>
        <Image source={resolveImageSource(src)} style={StyleSheet.absoluteFill} contentFit="cover" />
      </View>
    )
  }
  const inverted = tone === 'inverted'
  return (
    <View
      style={[
        base,
        inverted
          ? { backgroundColor: colors.surface.inverted }
          : { backgroundColor: colors.brand[50], borderWidth: 1, borderColor: colors.brand[100] },
        style,
      ]}
    >
      <Text noTranslate style={{ fontSize: fs, fontWeight: '600', color: inverted ? '#fff' : colors.brand[700] }}>
        {initials(name)}
      </Text>
    </View>
  )
}
