import { View, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNetworkStatus } from '../../lib/useNetworkStatus'
import { colors, shadows } from '../../theme'
import { Text } from '../ui/Text'

// Connectivity notice (port of components/common/NetworkBanner.jsx): floats over the content and
// only occupies space while it has something to say.
export function NetworkBanner() {
  const { isOnline, justReconnected } = useNetworkStatus()
  const insets = useSafeAreaInsets()
  if (isOnline && !justReconnected) return null
  const offline = !isOnline
  return (
    <View pointerEvents="none" style={[styles.wrap, { paddingTop: insets.top + 8 }]}>
      <View style={[styles.pill, shadows.lg, { backgroundColor: offline ? colors.slate[900] : colors.emerald[600] }]}>
        <View style={[styles.dot, { backgroundColor: offline ? colors.amber[400] : '#fff' }]} />
        <Text style={styles.text}>
          {offline ? "You're offline. Please check your internet connection." : 'Back online.'}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center', paddingHorizontal: 12, zIndex: 9000, elevation: 9000 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 9999, paddingHorizontal: 16, paddingVertical: 8 },
  dot: { height: 6, width: 6, borderRadius: 3 },
  text: { fontSize: 11, fontWeight: '700', color: '#fff' },
})
