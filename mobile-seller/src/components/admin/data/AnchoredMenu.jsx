import { useState } from 'react'
import { Dimensions, Modal, Pressable, StyleSheet, View } from 'react-native'
import { colors, radius, shadows } from '../../../theme'

// Native stand-in for the web's absolutely-positioned / portalled dropdown (RowActions, ExportMenu).
// `useAnchoredMenu()` gives a callback ref (`setTrigger`) for the trigger and open/close; `<AnchoredMenu>` renders the
// floating panel next to it in a transparent Modal so it is never clipped by a scroll container.
export function useAnchoredMenu() {
  const [trigger, setTrigger] = useState(null)
  const [anchor, setAnchor] = useState(null)

  function open() {
    trigger?.measureInWindow((x, y, width, height) => setAnchor({ x, y, width, height }))
  }

  return { setTrigger, anchor, open, close: () => setAnchor(null), isOpen: Boolean(anchor) }
}

export function AnchoredMenu({ anchor, onClose, width = 192, children }) {
  if (!anchor) return null
  const { width: screenW, height: screenH } = Dimensions.get('window')
  const spaceBelow = screenH - (anchor.y + anchor.height)
  const showAbove = spaceBelow < 220 && anchor.y > 220
  const left = Math.min(Math.max(12, anchor.x + anchor.width - width), screenW - width - 12)

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close menu" />
      <View
        style={[
          styles.menu,
          shadows.overlay,
          { width, left },
          showAbove ? { bottom: screenH - anchor.y + 4 } : { top: anchor.y + anchor.height + 4 },
        ]}
      >
        {children}
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  menu: {
    position: 'absolute', overflow: 'hidden', borderRadius: radius.lg, borderWidth: 1,
    borderColor: colors.border.DEFAULT, backgroundColor: colors.surface.DEFAULT, paddingVertical: 4,
  },
})
