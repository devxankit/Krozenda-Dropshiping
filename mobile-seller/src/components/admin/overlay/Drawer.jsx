import { useEffect, useState } from 'react'
import { Animated, Dimensions, Easing, Keyboard, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Icon, Text } from '../../ui'
import { colors, shadows } from '../../../theme'

// max-w-* per width token (px). At phone width every panel is full width; `nav` is the 85vw / 18rem
// left drawer.
const MAX_WIDTH = Object.freeze({ nav: 288, sm: 384, md: 448, lg: 672, xl: 896 })

// The workhorse overlay of the panel: quick view from a table row, a filter sheet, the mobile
// nav. Slides in from `side`; Android back and a tap on the backdrop close it.
export function Drawer({
  isOpen,
  onClose,
  title,
  description,
  side = 'right',
  width = 'md',
  footer,
  children,
}) {
  const insets = useSafeAreaInsets()
  const [progress] = useState(() => new Animated.Value(0))
  const [mounted, setMounted] = useState(isOpen)
  const [kbHeight, setKbHeight] = useState(0)
  const screenW = Dimensions.get('window').width

  // Mount on open during render; unmount only after the exit animation (below).
  if (isOpen && !mounted) setMounted(true)

  useEffect(() => {
    if (isOpen) {
      Animated.timing(progress, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start()
      return undefined
    }
    Animated.timing(progress, { toValue: 0, duration: 160, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(
      ({ finished }) => {
        if (finished) setMounted(false)
      },
    )
    return undefined
  }, [isOpen, progress])

  useEffect(() => {
    if (!mounted) return undefined
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'
    const a = Keyboard.addListener(showEvt, (e) => setKbHeight(e.endCoordinates?.height || 0))
    const b = Keyboard.addListener(hideEvt, () => setKbHeight(0))
    return () => {
      a.remove()
      b.remove()
    }
  }, [mounted])

  if (!mounted) return null

  const panelWidth = width === 'nav' ? Math.min(screenW * 0.85, MAX_WIDTH.nav) : Math.min(screenW, MAX_WIDTH[width] || MAX_WIDTH.md)
  const offscreen = side === 'left' ? -panelWidth : panelWidth
  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [offscreen, 0] })

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <View style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: progress }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        </Animated.View>
        <Animated.View
          accessibilityViewIsModal
          style={[
            styles.panel,
            shadows.overlay,
            side === 'left' ? styles.left : styles.right,
            { width: panelWidth, paddingTop: insets.top, paddingBottom: kbHeight ? kbHeight : insets.bottom, transform: [{ translateX }] },
          ]}
        >
          <View style={styles.header}>
            <View style={{ flex: 1, minWidth: 0 }}>
              {title ? <Text style={styles.title}>{title}</Text> : null}
              {description ? <Text style={styles.desc}>{description}</Text> : null}
            </View>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={8} style={styles.close}>
              <Icon name="close" size={16} color={colors.ink.faint} />
            </Pressable>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>

          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </Animated.View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backdrop: { backgroundColor: 'rgba(15,23,42,0.4)' },
  panel: { position: 'absolute', top: 0, bottom: 0, backgroundColor: colors.surface.DEFAULT },
  right: { right: 0, borderLeftWidth: 1, borderLeftColor: colors.border.DEFAULT },
  left: { left: 0, borderRightWidth: 1, borderRightColor: colors.border.DEFAULT },
  header: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border.DEFAULT, paddingHorizontal: 14, paddingVertical: 12,
  },
  title: { fontSize: 14, lineHeight: 20, fontWeight: '600', letterSpacing: -0.2, color: colors.slate[900] },
  desc: { marginTop: 2, fontSize: 11, lineHeight: 15, color: colors.ink.subtle },
  close: { marginRight: -4, marginTop: -2, borderRadius: 8, padding: 6 },
  footer: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: 8,
    borderTopWidth: 1, borderTopColor: colors.border.DEFAULT, backgroundColor: colors.surface.muted,
    paddingHorizontal: 14, paddingVertical: 10,
  },
})
