import { View, Pressable, StyleSheet } from 'react-native'
import Animated, { FadeInUp, FadeOutUp, LinearTransition, ReduceMotion } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useToastStore, toast } from '../../lib/toast'
import { colors, shadows } from '../../theme'
import { Text } from './Text'
import { Icon } from './Icon'

const ENTER = FadeInUp.duration(200).reduceMotion(ReduceMotion.System)
const EXIT = FadeOutUp.duration(150).reduceMotion(ReduceMotion.System)
const LAYOUT = LinearTransition.duration(180).reduceMotion(ReduceMotion.System)

// Renders lib/toast. Look follows App.jsx's Toaster: white card, slate-200 border, radius 16,
// 13px/500 text, close button; success #10b981, error #ef4444 icons.
const ICON = {
  success: { name: 'HiCheckCircle', color: '#10b981' },
  error: { name: 'HiXCircle', color: '#ef4444' },
  warning: { name: 'HiExclamationTriangle', color: colors.amber[500] },
  info: { name: 'HiInformationCircle', color: colors.blue[500] },
}

export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts)
  const insets = useSafeAreaInsets()
  // Always mounted (empty + box-none when idle) so the last toast can play its exit animation.
  return (
    <View pointerEvents="box-none" style={[styles.host, { top: insets.top + 12 }]}>
      {toasts.map((t) => {
        const icon = ICON[t.type]
        return (
          <Animated.View
            key={t.id}
            entering={ENTER}
            exiting={EXIT}
            layout={LAYOUT}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            style={[styles.toast, shadows.lg]}
          >
            {t.type === 'loading' ? null : icon ? <Icon name={icon.name} size={20} color={icon.color} /> : null}
            <View style={{ flex: 1 }}>
              <Text style={t.description ? styles.titleStrong : styles.title}>{t.title}</Text>
              {t.description ? <Text style={styles.desc}>{t.description}</Text> : null}
            </View>
            {t.type !== 'loading' ? (
              <Pressable onPress={() => toast.dismiss(t.id)} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close notification">
                <Icon name="HiXMark" size={16} color={colors.slate[400]} />
              </Pressable>
            ) : null}
          </Animated.View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: 16, right: 16, gap: 10, zIndex: 9999, elevation: 9999 },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.slate[200],
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  title: { fontSize: 13, fontWeight: '500', color: colors.slate[900] },
  titleStrong: { fontSize: 14, fontWeight: '600', color: colors.slate[900] },
  desc: { fontSize: 12, color: colors.slate[600], marginTop: 2 },
})
