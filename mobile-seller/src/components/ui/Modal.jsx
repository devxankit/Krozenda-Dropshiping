import { Pressable, ScrollView, View, StyleSheet } from 'react-native'
import { colors, radius, shadows } from '../../theme'
import { Text } from './Text'
import { Icon } from './Icon'
import { Sheet } from './Sheet'

// Port of components/ui/Modal.jsx at phone width: a centred dialog (12px outer gutter, full width)
// with header (title, description, close), scrolling body and optional footer. Android back closes it.
// `size` only changes max-width on the web (all wider than a phone), so it has no effect here.
export function Modal({ isOpen, onClose, title, description, children, footer, closeOnOverlayClick = true }) {
  return (
    <Sheet visible={!!isOpen} onClose={onClose} variant="center" inset={12} maxHeight="100%" dismissable={closeOnOverlayClick} style={styles.dialog}>
      <View style={styles.header}>
        <View style={{ flex: 1, minWidth: 0 }}>
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {description ? <Text style={styles.desc}>{description}</Text> : null}
        </View>
        <Pressable onPress={onClose} accessibilityLabel="Close" hitSlop={8} style={styles.close}>
          <Icon name="close" size={16} color={colors.ink.faint} />
        </Pressable>
      </View>
      <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
        {children}
      </ScrollView>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </Sheet>
  )
}

const styles = StyleSheet.create({
  dialog: { borderRadius: radius.xl, borderColor: colors.border.DEFAULT, ...shadows.overlay },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.DEFAULT,
    backgroundColor: colors.surface.DEFAULT,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  title: { fontSize: 14, lineHeight: 20, fontWeight: '600', letterSpacing: -0.15, color: colors.slate[900] },
  desc: { marginTop: 2, fontSize: 11, lineHeight: 15, color: colors.ink.subtle },
  close: { marginRight: -4, marginTop: -2, padding: 6, borderRadius: radius.md },
  body: { paddingHorizontal: 14, paddingVertical: 12 },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border.DEFAULT,
    backgroundColor: colors.surface.muted,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
})
