import { useEffect, useRef } from 'react'
import { Pressable } from 'react-native'
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  LinearTransition,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'

// Shared motion primitives (Reanimated, UI-thread). Every one honours the system "reduce motion"
// setting. Keep durations short (<= 250 ms) - motion is feedback, not decoration.

export { Animated, useReducedMotion }

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

// Pressable with a subtle scale-down while pressed (cards, tiles, icon buttons).
export function PressableScale({ children, style, scaleTo = 0.97, disabled, onPressIn, onPressOut, ...props }) {
  const scale = useSharedValue(1)
  const reduce = useReducedMotion()
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))
  return (
    <AnimatedPressable
      {...props}
      disabled={disabled}
      onPressIn={(e) => {
        if (!reduce) scale.value = withTiming(scaleTo, { duration: 90 })
        onPressIn?.(e)
      }}
      onPressOut={(e) => {
        if (!reduce) scale.value = withSpring(1, { damping: 14, stiffness: 260 })
        onPressOut?.(e)
      }}
      style={[style, animated]}
    >
      {children}
    </AnimatedPressable>
  )
}

// Entering animation preset for list rows / sections: fade + 8px rise. `index` staggers the first few
// items only (capped) so long lists never feel slow.
export function enterFade(index = 0) {
  return FadeInDown.delay(Math.min(index, 6) * 40)
    .duration(220)
    .reduceMotion(ReduceMotion.System)
}

export const fadeOut = FadeOut.duration(150).reduceMotion(ReduceMotion.System)
export const fadeIn = FadeIn.duration(180).reduceMotion(ReduceMotion.System)

// Smooth re-layout when siblings are inserted/removed (cart lines, wishlist cards).
export const smoothLayout = LinearTransition.duration(200).reduceMotion(ReduceMotion.System)

// "Pop" for confirmations - the heart on the wishlist toggle, the cart badge, success ticks.
export function usePop(trigger) {
  const scale = useSharedValue(1)
  const reduce = useReducedMotion()
  const first = useRef(true)
  useEffect(() => {
    // Never pop on mount - only when `trigger` actually changes afterwards.
    if (first.current) {
      first.current = false
      return
    }
    if (reduce || trigger === undefined) return
    scale.value = withSequence(withTiming(1.18, { duration: 110 }), withSpring(1, { damping: 8, stiffness: 220 }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger])
  return useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))
}
