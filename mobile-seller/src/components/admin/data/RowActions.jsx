import { Pressable, StyleSheet, View } from 'react-native'
import { Icon, Text } from '../../ui'
import { useAuthStore } from '../../../lib/authStore'
import { colors, radius } from '../../../theme'
import { AnchoredMenu, useAnchoredMenu } from './AnchoredMenu'

// The per-row action menu. Items carry an optional `permission`; anything the signed-in role
// cannot do is not rendered at all rather than rendered disabled.
export function RowActions({ items = [], label = 'Row actions' }) {
  const { setTrigger, anchor, open, close, isOpen } = useAnchoredMenu()
  const permissions = useAuthStore((state) => state.permissions) || []

  const visible = items.filter((item) => !item.permission || permissions.includes(item.permission))

  if (visible.length === 0) return null

  return (
    <View style={{ alignItems: 'flex-end' }}>
      <Pressable
        ref={setTrigger}
        collapsable={false}
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => (isOpen ? close() : open())}
        style={styles.trigger}
      >
        <Icon name="moreHorizontal" size={16} color={colors.ink.faint} />
      </Pressable>

      <AnchoredMenu anchor={anchor} onClose={close} width={192}>
        {visible.map((item) => (
          <Pressable
            key={item.label}
            disabled={item.disabled}
            accessibilityRole="menuitem"
            onPress={() => {
              close()
              item.onSelect?.()
            }}
            style={({ pressed }) => [
              styles.item,
              item.disabled && { opacity: 0.4 },
              pressed && { backgroundColor: item.tone === 'danger' ? colors.danger[50] : colors.surface.muted },
            ]}
          >
            {item.icon ? <Icon name={item.icon} size={16} color={colors.ink.faint} /> : null}
            <Text style={[styles.itemText, { color: item.tone === 'danger' ? colors.danger[700] : colors.slate[700] }]}>
              {item.label}
            </Text>
          </Pressable>
        ))}
      </AnchoredMenu>
    </View>
  )
}

const styles = StyleSheet.create({
  trigger: { borderRadius: radius.md, padding: 6 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 8 },
  itemText: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
})
