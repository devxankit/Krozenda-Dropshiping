import { useCallback, useRef, useState } from 'react'
import { Animated, Easing, Pressable, RefreshControl, StyleSheet, TextInput, View } from 'react-native'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import { LanguageSwitcher } from '../../../../components/common/LanguageSwitcher'
import { Screen } from '../../../../components/layout/Screen'
import { Icon } from '../../../../components/ui/Icon'
import { Animated as ReAnimated, usePop } from '../../../../components/ui/motion'
import { resolveImageSource } from '../../../../components/ui/SmartImage'
import { Text } from '../../../../components/ui/Text'
import { USER_ROUTES, userPath } from '../../../../config/routes'
import { useCartCount } from '../../../../lib/cartStore'
import { useUnreadNotificationCount } from '../../../../lib/notificationStore'
import { useT } from '../../../../lib/i18n'
import { colors, shadows } from '../../../../theme'
import { useHomeFeed } from '../../controllers/useHomeFeedController'
import { HomeCenterFeed } from './HomeCenterFeed'

// Port of onboarding/HomeScreen.jsx at phone width: sticky header (logo, search, language, bell, cart),
// the centre feed, and the bottom tab bar. The desktop WebHeader / Footer / left + right sidebars are
// not part of the phone layout.

const LOGO = resolveImageSource('/images/logo.png')
const LOGO_RATIO = 591 / 422 // h-8 w-auto

const FALLBACK_TRUST_TILES = [
  { id: 'trust-dispatch', title: '15-30m Dispatch', subtitle: 'Fast Delivery Express', icon: 'truck', theme: 'blue' },
  { id: 'trust-price', title: 'Factory Direct Price', subtitle: 'Zero Middlemen Margin', icon: 'currency', theme: 'amber' },
  { id: 'trust-quality', title: '100% Quality Checked', subtitle: 'Certified & Inspected', icon: 'shield', theme: 'emerald' },
  { id: 'trust-replacement', title: 'Safe Escrow Protection', subtitle: 'Easy Returns & Refund', icon: 'refresh', theme: 'purple' },
]

// Cart count badge; pops when the count changes.
function CartBadge({ count }) {
  const popStyle = usePop(count)
  return (
    <ReAnimated.View style={[styles.cartBadge, popStyle]}>
      <Text noTranslate style={styles.cartBadgeText}>{count > 9 ? '9+' : count}</Text>
    </ReAnimated.View>
  )
}

export function HomeScreen() {
  const router = useRouter()
  const t = useT()
  const queryClient = useQueryClient()
  const [mobileSearchQuery, setMobileSearchQuery] = useState('')
  // While the mobile search is focused the logo and the icon cluster slide away so the input can take
  // the whole header row.
  const [mobileSearchFocused, setMobileSearchFocused] = useState(false)
  const [focusAnim] = useState(() => new Animated.Value(0))
  const searchInputRef = useRef(null)
  const cartCount = useCartCount()
  const unreadCount = useUnreadNotificationCount()
  const [refreshing, setRefreshing] = useState(false)

  const { categories, flashSale, trending, brands, banners, isLoading } = useHomeFeed()

  const setFocused = useCallback(
    (focused) => {
      setMobileSearchFocused(focused)
      Animated.timing(focusAnim, {
        toValue: focused ? 1 : 0,
        duration: 300,
        easing: Easing.out(Easing.ease),
        useNativeDriver: false,
      }).start()
    },
    [focusAnim],
  )

  const handleSearchSubmit = () => {
    const q = mobileSearchQuery.trim()
    router.push(q ? userPath.search(q) : USER_ROUTES.LISTING)
  }

  // Cross button: first tap clears the text, tap on an empty box closes search mode.
  const handleSearchClear = () => {
    if (mobileSearchQuery) {
      setMobileSearchQuery('')
      searchInputRef.current?.focus()
    } else {
      searchInputRef.current?.blur()
    }
  }

  // Pull to refresh (the Flutter wrapper's pull-to-refresh): re-fetch everything on the page.
  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await queryClient.refetchQueries({ queryKey: ['catalog'] })
    } finally {
      setRefreshing(false)
    }
  }, [queryClient])

  const logoMaxW = focusAnim.interpolate({ inputRange: [0, 1], outputRange: [96, 0] })
  const logoMr = focusAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] })
  const iconsMaxW = focusAnim.interpolate({ inputRange: [0, 1], outputRange: [200, 0] })
  const iconsMl = focusAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] })
  const fade = focusAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] })

  const header = (
    <View style={[styles.header, shadows.xs]}>
      <View style={styles.headerRow}>
        <Animated.View style={[styles.logoWrap, { maxWidth: logoMaxW, marginRight: logoMr, opacity: fade }]} pointerEvents={mobileSearchFocused ? 'none' : 'auto'}>
          <Pressable onPress={() => router.push(USER_ROUTES.DASHBOARD)} accessibilityLabel="Krozenda Home">
            <Image source={LOGO} contentFit="contain" style={{ height: 32, width: 32 * LOGO_RATIO }} />
          </Pressable>
        </Animated.View>

        <View style={styles.searchWrap}>
          <View style={[styles.search, mobileSearchFocused && { backgroundColor: '#fff' }]}>
            <Icon name="HiMagnifyingGlass" size={14} color={colors.slate[400]} />
            <TextInput
              ref={searchInputRef}
              value={mobileSearchQuery}
              onChangeText={setMobileSearchQuery}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onSubmitEditing={handleSearchSubmit}
              placeholder={t('Search products, brands, categories...')}
              placeholderTextColor={colors.slate[400]}
              returnKeyType="search"
              style={styles.searchInput}
            />
            {mobileSearchFocused || mobileSearchQuery ? (
              <Pressable
                onPress={handleSearchClear}
                accessibilityLabel={mobileSearchQuery ? 'Clear search' : 'Close search'}
                style={styles.clearBtn}
              >
                <Icon name="HiXMark" size={16} color={colors.slate[400]} />
              </Pressable>
            ) : null}
          </View>
          {mobileSearchFocused ? <View pointerEvents="none" style={styles.searchRing} /> : null}
        </View>

        <Animated.View
          style={[styles.icons, { maxWidth: iconsMaxW, marginLeft: iconsMl, opacity: fade }]}
          pointerEvents={mobileSearchFocused ? 'none' : 'auto'}
        >
          <LanguageSwitcher variant="compact" />
          <Pressable onPress={() => router.push(USER_ROUTES.NOTIFICATIONS)} accessibilityRole="button" accessibilityLabel={unreadCount > 0 ? "Notifications, unread" : "Notifications"} style={styles.iconBtn}>
            <Icon name="HiBell" size={20} color={colors.slate[600]} />
            {unreadCount > 0 ? <View style={styles.unreadDot} /> : null}
          </Pressable>
          <Pressable onPress={() => router.push(USER_ROUTES.CART)} accessibilityRole="button" accessibilityLabel={cartCount > 0 ? `Cart, ${cartCount} items` : "Cart"} style={styles.iconBtn}>
            <Icon name="HiOutlineShoppingBag" size={20} color={colors.slate[600]} />
            {cartCount > 0 ? <CartBadge count={cartCount} /> : null}
          </Pressable>
        </Animated.View>
      </View>
    </View>
  )

  return (
    <Screen
      tab
      header={header}
      background={colors.slate[50]}
      contentStyle={{ paddingHorizontal: 12, paddingTop: 12 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.blue[600]]} />}
    >
      <HomeCenterFeed
        categories={categories}
        flashSale={flashSale}
        trending={trending}
        brands={brands}
        banners={banners}
        isLoading={isLoading}
        trustTiles={FALLBACK_TRUST_TILES}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  header: {
    zIndex: 40,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(226,232,240,0.8)',
  },
  headerRow: { paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logoWrap: { overflow: 'hidden', flexShrink: 0 },
  searchWrap: { flex: 1, minWidth: 0 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(241,245,249,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.8)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    ...shadows['2xs'],
  },
  // focus-within:ring-2 ring-blue-600
  searchRing: { position: 'absolute', top: -2, left: -2, right: -2, bottom: -2, borderRadius: 999, borderWidth: 2, borderColor: colors.blue[600] },
  searchInput: { flex: 1, minWidth: 0, paddingHorizontal: 8, paddingVertical: 0, height: 20, fontSize: 12, fontFamily: 'PlusJakartaSans_400Regular', color: colors.slate[800] },
  clearBtn: { padding: 2, marginRight: -4, borderRadius: 999 },
  icons: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0, overflow: 'hidden', marginVertical: -4, paddingVertical: 4 },
  iconBtn: { padding: 6, borderRadius: 999 },
  unreadDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.red[500],
    borderWidth: 2,
    borderColor: '#fff',
  },
  cartBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.blue[600],
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadgeText: { fontSize: 9, lineHeight: 12, fontWeight: '700', color: '#fff' },
})
