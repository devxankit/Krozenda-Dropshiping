import { Pressable, StyleSheet, View } from 'react-native'
import { usePathname, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Icon } from '../../../../components/ui/Icon'
import { Text } from '../../../../components/ui/Text'
import { useKeyboardOpen } from '../../../../lib/useKeyboardOpen'
import { useVendorDashboardController } from '../../controllers/useVendorController'
import { colors, radius } from '../../../../theme'

export function VendorBottomNav({ onOpenMobileNav }) {
  const pathname = usePathname()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const keyboardOpen = useKeyboardOpen()

  const { data: summary } = useVendorDashboardController()
  const pendingOrders = summary?.pendingOrdersCount || 0

  const tabs = [
    { id: 'dashboard', label: 'Home', icon: 'dashboard', to: '/dashboard', isActive: pathname.startsWith('/dashboard') },
    { id: 'orders', label: 'Orders', icon: 'orders', to: '/orders', isActive: pathname.startsWith('/orders'), badge: pendingOrders > 0 ? pendingOrders : null },
    { id: 'products', label: 'Products', icon: 'products', to: '/products', isActive: pathname.startsWith('/products') },
    { id: 'earnings', label: 'Earnings', icon: 'settlements', to: '/earnings', isActive: pathname.startsWith('/earnings') || pathname.startsWith('/revenue') },
    { id: 'menu', label: 'More', icon: 'menu', action: onOpenMobileNav, isActive: false },
  ]

  if (keyboardOpen) return null

  return (
    <View accessibilityLabel="Seller Mobile Navigation" style={[styles.nav, { paddingBottom: 4 + insets.bottom }]}>
      <View style={styles.grid}>
        {tabs.map((tab) => (
          <Pressable
            key={tab.id}
            onPress={() => (tab.action ? tab.action() : router.navigate(tab.to))}
            accessibilityRole="button"
            accessibilityState={{ selected: tab.isActive }}
            style={[styles.tab, tab.isActive && styles.tabActive]}
          >
            <View>
              <Icon name={tab.icon} size={18} color={tab.isActive ? colors.brand[600] : colors.slate[500]} />
              {tab.badge ? (
                <View style={styles.badge}>
                  <Text noTranslate style={styles.badgeText}>{tab.badge > 99 ? '99+' : tab.badge}</Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.label, tab.isActive ? styles.labelActive : null]}>{tab.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  nav: { borderTopWidth: 1, borderTopColor: 'rgba(226,232,240,0.8)', backgroundColor: 'rgba(255,255,255,0.95)', paddingHorizontal: 8, paddingTop: 4 },
  grid: { flexDirection: 'row', alignSelf: 'center', width: '100%', maxWidth: 448 },
  tab: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.lg, paddingHorizontal: 4, paddingVertical: 2, borderWidth: 1, borderColor: 'transparent' },
  tabActive: { backgroundColor: 'rgba(239,246,255,0.7)', borderColor: 'rgba(219,234,254,0.6)' },
  label: { marginTop: 2, fontSize: 10, letterSpacing: -0.2, fontWeight: '500', color: colors.slate[500] },
  labelActive: { fontWeight: '700', color: colors.brand[700] },
  badge: { position: 'absolute', top: -6, right: -10, height: 14, minWidth: 14, paddingHorizontal: 4, borderRadius: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.amber[500] },
  badgeText: { fontSize: 9, fontWeight: '700', color: '#fff' },
})
