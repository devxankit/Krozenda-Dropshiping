import { useState } from 'react'
import { Modal, Pressable, StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'
import Svg, { Path } from 'react-native-svg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Avatar } from '../../../../components/ui/Avatar'
import { Icon } from '../../../../components/ui/Icon'
import { Text } from '../../../../components/ui/Text'
import { LanguageSwitcher } from '../../../../components/common/LanguageSwitcher'
import { useAuthStore } from '../../../../lib/authStore'
import { toast } from '../../../../lib/toast'
import { colors, radius, shadows } from '../../../../theme'

export function VendorTopbar({ onOpenMobileNav, onSignOut }) {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const user = useAuthStore((state) => state.user)
  const [menuOpen, setMenuOpen] = useState(false)

  const storeName = user?.storeName || user?.name || 'Arya Manufacturing'
  const email = user?.email || 'seller@krozenda.com'

  const go = (path) => {
    setMenuOpen(false)
    router.navigate(path)
  }

  return (
    <View style={[styles.header, { paddingTop: insets.top, height: 48 + insets.top }]}>
      <View style={styles.left}>
        <Pressable onPress={onOpenMobileNav} accessibilityLabel="Open navigation menu" style={styles.iconBtn}>
          <Icon name="menu" size={18} color={colors.slate[700]} />
        </Pressable>
        <View style={styles.titleRow}>
          <Text numberOfLines={1} style={styles.title}>{storeName}</Text>
          <Svg width={12} height={12} viewBox="0 0 20 20" fill={colors.brand[600]}>
            <Path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </Svg>
        </View>
      </View>

      <View style={styles.right}>
        <Pressable
          onPress={() => toast.info('Quick Search', 'Use table search in Products or Orders page.')}
          accessibilityLabel="Search"
          style={styles.iconBtn}
        >
          <Icon name="search" size={16} color={colors.slate[600]} />
        </Pressable>

        <LanguageSwitcher variant="compact" />

        <Pressable
          onPress={() => toast.info('Sub-Orders Pending', '6 assigned sub-orders waiting for packing & shipping label.')}
          accessibilityLabel="Notifications"
          style={styles.iconBtn}
        >
          <Icon name="notifications" size={16} color={colors.slate[600]} />
          <View style={styles.dot} />
        </Pressable>

        <Pressable onPress={() => setMenuOpen(true)} accessibilityRole="button" accessibilityLabel="Account menu" style={styles.avatarBtn}>
          <Avatar name={storeName} size="sm" tone="inverted" />
        </Pressable>
      </View>

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)} statusBarTranslucent>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenuOpen(false)} />
        <View pointerEvents="box-none" style={{ paddingTop: insets.top + 48 + 8, paddingRight: 12, alignItems: 'flex-end' }}>
          <View style={[styles.menu, shadows.xl]}>
            <View style={styles.menuHead}>
              <Text numberOfLines={1} style={styles.menuName}>{storeName}</Text>
              <Text numberOfLines={1} style={styles.menuEmail}>{email}</Text>
            </View>
            <View style={{ padding: 4 }}>
              <Pressable onPress={() => go('/kyc-documents')} style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: colors.surface.muted }]}>
                <Icon name="kyc" size={16} color={colors.ink.faint} />
                <Text style={styles.menuText}>KYC Verification</Text>
              </Pressable>
              <Pressable onPress={() => go('/settings')} style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: colors.surface.muted }]}>
                <Icon name="settings" size={16} color={colors.ink.faint} />
                <Text style={styles.menuText}>Store Settings</Text>
              </Pressable>
            </View>
            <View style={{ borderTopWidth: 1, borderTopColor: colors.border.DEFAULT, padding: 4 }}>
              <Pressable
                onPress={() => {
                  setMenuOpen(false)
                  onSignOut()
                }}
                style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: colors.danger[50] }]}
              >
                <Icon name="logout" size={16} color={colors.danger[700]} />
                <Text style={[styles.menuText, { color: colors.danger[700] }]}>Sign out</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, backgroundColor: 'rgba(255,255,255,0.95)', borderBottomWidth: 1, borderBottomColor: colors.border.DEFAULT },
  left: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0, flexShrink: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 0, flexShrink: 1 },
  title: { fontSize: 12, fontWeight: '700', letterSpacing: -0.2, color: colors.slate[900], flexShrink: 1 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconBtn: { height: 32, width: 32, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md },
  dot: { position: 'absolute', right: 6, top: 6, height: 6, width: 6, borderRadius: 3, borderWidth: 1, borderColor: '#fff', backgroundColor: colors.brand[500] },
  avatarBtn: { padding: 4, borderRadius: radius.lg },
  menu: { width: 256, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border.DEFAULT, backgroundColor: colors.surface.DEFAULT, overflow: 'hidden' },
  menuHead: { borderBottomWidth: 1, borderBottomColor: colors.border.DEFAULT, backgroundColor: colors.surface.muted, paddingHorizontal: 14, paddingVertical: 12 },
  menuName: { fontSize: 14, fontWeight: '600', color: colors.slate[900] },
  menuEmail: { fontSize: 12, color: colors.ink.subtle },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingVertical: 8, borderRadius: radius.DEFAULT },
  menuText: { fontSize: 14, color: colors.ink.muted },
})
