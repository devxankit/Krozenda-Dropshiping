import { View, StyleSheet } from 'react-native'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import { Text } from '../../../../components/ui/Text'
import { colors } from '../../../../theme'

// Wordmark used in the mobile drawer header (port of admin navStyles BrandMark).
export function BrandMark({ label }) {
  return (
    <View style={styles.row}>
      <View style={styles.logo}>
        <Svg width={28} height={28} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="brandMark" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={colors.brand[500]} />
              <Stop offset="1" stopColor={colors.brand[700]} />
            </LinearGradient>
          </Defs>
          <Rect width={28} height={28} fill="url(#brandMark)" />
        </Svg>
        <Text noTranslate style={styles.k}>K</Text>
      </View>
      <Text noTranslate style={styles.name}>Krozenda</Text>
      {label ? (
        <View style={styles.tag}>
          <Text noTranslate style={styles.tagText}>{label}</Text>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 },
  logo: { height: 28, width: 28, borderRadius: 8, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  k: { fontSize: 14, fontWeight: '700', color: '#fff' },
  name: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2, color: colors.slate[900] },
  tag: { borderRadius: 4, backgroundColor: colors.surface.sunken, paddingHorizontal: 6, paddingVertical: 2 },
  tagText: { fontSize: 10, fontWeight: '600', letterSpacing: 0.8, color: colors.ink.subtle },
})
