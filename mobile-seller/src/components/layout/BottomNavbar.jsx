import { useEffect, useState } from 'react'
import { Keyboard, View, StyleSheet } from 'react-native'
import { usePathname, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { USER_ROUTES } from '../../config/routes'
import { colors } from '../../theme'
import { Icon } from '../ui/Icon'
import { PressableScale } from '../ui/motion'
import { Text } from '../ui/Text'

// Port of components/layout/BottomNavbar.jsx (mobile bar). Active tab derives from the path unless
// `activeTab` is passed; hidden while the keyboard is open (useKeyboardOpen on the web).
const TABS = [
  { id: 'home', label: 'Home', route: USER_ROUTES.DASHBOARD, on: 'HiHome', off: 'HiOutlineHome' },
  { id: 'categories', label: 'Categories', route: USER_ROUTES.CATEGORIES, on: 'HiSquares2X2', off: 'HiOutlineSquares2X2' },
  { id: 'orders', label: 'Orders', route: USER_ROUTES.ORDERS, on: 'HiShoppingBag', off: 'HiOutlineShoppingBag' },
  { id: 'wishlist', label: 'Wishlist', route: USER_ROUTES.WISHLIST, on: 'HiHeart', off: 'HiOutlineHeart' },
  { id: 'profile', label: 'Profile', route: USER_ROUTES.PROFILE, on: 'HiUser', off: 'HiOutlineUser' },
]

function tabFromPath(path) {
  if (path.includes('/categories')) return 'categories'
  if (path.includes('/orders')) return 'orders'
  if (path.includes('/wishlist')) return 'wishlist'
  if (path.includes('/profile') || path.includes('/settings') || path.includes('/coupons') || path.includes('/support')) return 'profile'
  return 'home'
}

export function useKeyboardOpen() {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const a = Keyboard.addListener('keyboardDidShow', () => setOpen(true))
    const b = Keyboard.addListener('keyboardDidHide', () => setOpen(false))
    return () => {
      a.remove()
      b.remove()
    }
  }, [])
  return open
}

export function BottomNavbar({ activeTab, onChangeTab }) {
  const router = useRouter()
  const pathname = usePathname()
  const insets = useSafeAreaInsets()
  const keyboardOpen = useKeyboardOpen()
  const current = activeTab || tabFromPath(pathname)
  if (keyboardOpen) return null

  return (
    <View style={[styles.nav, { paddingBottom: 6 + insets.bottom }]} accessibilityRole="tablist">
      <View style={styles.row}>
        {TABS.map((tab) => {
          const isActive = current === tab.id
          return (
            <PressableScale
              key={tab.id}
              scaleTo={0.93}
              onPress={() => (onChangeTab ? onChangeTab(tab.id) : router.replace(tab.route))}
              accessibilityRole="tab"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: isActive }}
              style={[styles.tab, isActive && styles.tabActive]}
            >
              <Icon
                name={isActive ? tab.on : tab.off}
                size={20}
                color={isActive ? colors.blue[600] : colors.slate[500]}
                style={isActive ? { transform: [{ scale: 1.1 }] } : undefined}
              />
              <Text style={[styles.label, isActive ? styles.labelActive : styles.labelIdle]}>{tab.label}</Text>
            </PressableScale>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  nav: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    borderTopColor: 'rgba(226,232,240,0.8)',
    backgroundColor: 'rgba(255,255,255,0.97)',
    paddingHorizontal: 8,
    paddingTop: 6,
    elevation: 16,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 25,
    shadowOffset: { width: 0, height: 25 },
  },
  row: { flexDirection: 'row', maxWidth: 448, width: '100%', alignSelf: 'center' },
  tab: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    paddingHorizontal: 4,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabActive: { backgroundColor: colors.blue[50], borderColor: 'rgba(219,234,254,0.8)' },
  label: { fontSize: 10, marginTop: 4, letterSpacing: -0.25 },
  labelActive: { color: colors.blue[700], fontWeight: '700' },
  labelIdle: { color: colors.slate[500], fontWeight: '500' },
})
