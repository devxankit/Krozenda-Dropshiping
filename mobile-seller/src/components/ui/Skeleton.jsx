import { useEffect } from 'react'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { colors } from '../../theme'

// Pulse placeholder (UI-thread opacity loop; static when the system asks for reduced motion).
export function Skeleton({ style }) {
  const opacity = useSharedValue(1)
  const reduce = useReducedMotion()
  useEffect(() => {
    if (reduce) return undefined
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.55, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
    )
    return undefined
  }, [opacity, reduce])
  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }))
  return <Animated.View style={[{ backgroundColor: colors.slate[100], borderRadius: 6 }, style, animated]} />
}
