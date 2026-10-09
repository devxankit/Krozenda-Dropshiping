import { Modal, Pressable, View, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, shadows } from '../../theme'

// Native replacement for the web's Modal / bottom-sheet / popover. variant="sheet" slides up from
// the bottom (rounded top, like the mobile web sheets); variant="center" is a centred dialog.
// Android back closes it (onRequestClose).
export function Sheet({ visible, onClose, children, variant = 'sheet', dismissable = true, maxHeight = '90%', style }) {
  const insets = useSafeAreaInsets()
  const sheet = variant === 'sheet'
  return (
    <Modal
      visible={visible}
      transparent
      animationType={sheet ? 'slide' : 'fade'}
      onRequestClose={dismissable ? onClose : undefined}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.backdrop, { justifyContent: sheet ? 'flex-end' : 'center', padding: sheet ? 0 : 20 }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={dismissable ? onClose : undefined}
            accessibilityRole="button"
            accessibilityLabel="Close"
          />
          <View
            style={[
              sheet ? styles.sheet : styles.dialog,
              shadows['2xl'],
              { maxHeight, paddingBottom: sheet ? insets.bottom : 0 },
              style,
            ]}
          >
            {sheet ? <View pointerEvents="none" style={styles.handle} /> : null}
            {children}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  handle: { alignSelf: 'center', marginTop: 8, marginBottom: 2, height: 4, width: 36, borderRadius: 2, backgroundColor: colors.slate[300] },
  dialog: { backgroundColor: '#fff', borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: colors.slate[100] },
})
