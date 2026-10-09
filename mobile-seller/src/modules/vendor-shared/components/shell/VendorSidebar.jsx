import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { usePathname, useRouter } from 'expo-router'
import { Icon } from '../../../../components/ui/Icon'
import { Text } from '../../../../components/ui/Text'
import { colors, radius } from '../../../../theme'
import { getVendorNavTree, isVendorItemActive } from '../../lib/vendorNav'
import { useVendorOnboardingState } from '../../controllers/useVendorController'
import { VENDOR_ONBOARDING_ALLOWED } from '../../constants'
import { BrandMark } from './BrandMark'
import { toast } from '../../../../lib/toast'

// The mobile drawer ("variant=drawer" of the web VendorSidebar): 40px touch rows, closes on navigation.
function NavItem({ item, locked, onNavigate }) {
  const pathname = usePathname()
  const router = useRouter()
  const active = isVendorItemActive(item, pathname)

  // Locked items stay visible (a seller waiting on approval can see what the panel will give them) and
  // are rendered as disabled rows, not links.
  if (locked) {
    return (
      <Pressable
        onPress={() => toast.info(item.label, 'Available once your account is approved')}
        accessibilityState={{ disabled: true }}
        style={styles.item}
      >
        <Icon name={item.icon} size={18} color={colors.ink.faint} style={{ opacity: 0.6 }} />
        <Text numberOfLines={1} style={[styles.label, { color: colors.ink.faint, flex: 1 }]}>{item.label}</Text>
        <Icon name="lock" size={12} color={colors.ink.faint} />
      </Pressable>
    )
  }

  return (
    <Pressable
      onPress={() => {
        onNavigate?.()
        router.navigate(item.to)
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [styles.item, active && styles.itemActive, pressed && !active && { backgroundColor: colors.surface.muted }]}
    >
      {active ? <View style={styles.bar} /> : null}
      <Icon name={item.icon} size={18} color={active ? colors.brand[600] : colors.ink.faint} />
      <Text numberOfLines={1} style={[styles.label, active ? styles.labelActive : null, { flex: 1 }]}>{item.label}</Text>
    </Pressable>
  )
}

export function VendorSidebar({ onToggle, onNavigate, onSignOut }) {
  const router = useRouter()
  const { isApproved } = useVendorOnboardingState()
  const groups = getVendorNavTree(false, isApproved)

  // Mirrors the onboarding gate's allow-list so the drawer never offers a destination the router would bounce.
  const isLocked = (item) => !isApproved && !VENDOR_ONBOARDING_ALLOWED.some((suffix) => item.to.endsWith(`/${suffix}`))

  return (
    <View style={styles.root}>
      <View style={styles.head}>
        <Pressable
          onPress={() => {
            onNavigate?.()
            router.navigate('/dashboard')
          }}
          accessibilityLabel="Krozenda vendor home"
          style={{ minWidth: 0, flexShrink: 1 }}
        >
          <BrandMark label="SELLER" />
        </Pressable>
        <Pressable onPress={onToggle} accessibilityLabel="Close navigation" style={styles.close}>
          <Icon name="close" size={16} color={colors.ink.subtle} />
        </Pressable>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 10, gap: 2 }} showsVerticalScrollIndicator={false}>
        {groups.map((group) => (
          <View key={group.id} style={{ gap: 2 }}>
            {group.label ? <Text style={styles.group}>{group.label}</Text> : null}
            {group.items.map((item) => (
              <NavItem key={item.to} item={item} locked={isLocked(item)} onNavigate={onNavigate} />
            ))}
          </View>
        ))}
      </ScrollView>

      <View style={styles.foot}>
        <Pressable onPress={onSignOut} accessibilityLabel="Log out" style={({ pressed }) => [styles.logout, pressed && { backgroundColor: colors.danger[50] }]}>
          <Icon name="logout" size={18} color={colors.ink.muted} />
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface.DEFAULT },
  head: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.border.DEFAULT },
  close: { height: 32, width: 32, alignItems: 'center', justifyContent: 'center', borderRadius: radius.DEFAULT },
  group: { paddingHorizontal: 10, paddingBottom: 6, paddingTop: 16, fontSize: 11, fontWeight: '600', letterSpacing: 0.9, textTransform: 'uppercase', color: colors.ink.faint },
  item: { height: 40, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 10, borderRadius: radius.DEFAULT },
  itemActive: { backgroundColor: colors.brand[50] },
  bar: { position: 'absolute', left: -10, top: 6, bottom: 6, width: 3, borderTopRightRadius: 9999, borderBottomRightRadius: 9999, backgroundColor: colors.brand[600] },
  label: { fontSize: 14, fontWeight: '500', color: colors.ink.muted },
  labelActive: { fontWeight: '600', color: colors.brand[700] },
  foot: { borderTopWidth: 1, borderTopColor: colors.border.DEFAULT, padding: 10 },
  logout: { height: 36, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 10, borderRadius: radius.DEFAULT },
  logoutText: { fontSize: 14, fontWeight: '500', color: colors.ink.muted },
})
