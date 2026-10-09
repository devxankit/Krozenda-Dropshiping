import { useEffect } from 'react'
import { View, StyleSheet } from 'react-native'
import { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated'
import { Animated } from '../../../../components/ui/motion'
import { Text } from '../../../../components/ui/Text'
import { colors, shadows } from '../../../../theme'

// The three-step checkout progress bar (Address -> Order Summary -> Payment). Phone layout only.
const STEPS = ['Address', 'Order Summary', 'Payment']

export function CheckoutStepper({ current }) {
  const reduce = useReducedMotion()
  const progress = useSharedValue(current / STEPS.length)
  useEffect(() => {
    const target = current / STEPS.length
    progress.value = reduce ? target : withTiming(target, { duration: 240 })
  }, [current, reduce, progress])
  const barStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }))
  return (
    <View
      style={styles.card}
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${current} of ${STEPS.length}: ${STEPS[current - 1]}`}
    >
      <View style={styles.row}>
      <Text style={styles.current}>{`Step ${current} of ${STEPS.length}: ${STEPS[current - 1]}`}</Text>
      {current === STEPS.length ? (
        <Text style={styles.final}>Final Step</Text>
      ) : (
        <Text style={styles.next}>{`Next: ${STEPS[current]}`}</Text>
      )}
      </View>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, barStyle, current === STEPS.length && { backgroundColor: colors.emerald[500] }]} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    gap: 10,
    marginBottom: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.8)',
    backgroundColor: '#fff',
    padding: 14,
    ...shadows.sm,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  track: { height: 4, borderRadius: 9999, backgroundColor: colors.slate[100], overflow: 'hidden' },
  fill: { height: 4, borderRadius: 9999, backgroundColor: colors.blue[600] },
  current: { fontSize: 12, lineHeight: 16, fontWeight: '800', color: colors.blue[700] },
  final: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: colors.emerald[600] },
  next: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: colors.slate[400] },
})
