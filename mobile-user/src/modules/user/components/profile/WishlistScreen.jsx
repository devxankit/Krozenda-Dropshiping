import { useEffect, useState } from 'react'
import { FlatList, Pressable, View, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { Screen } from '../../../../components/layout/Screen'
import { Text } from '../../../../components/ui/Text'
import { Icon } from '../../../../components/ui/Icon'
import { SmartImage } from '../../../../components/ui/SmartImage'
import { EmptyResult, ProductGridSkeleton } from '../../../../components/ui/AsyncBoundary'
import { USER_ROUTES, userPath } from '../../../../config/routes'
import { useWishlistStore } from '../../../../lib/wishlistStore'
import { useCartStore } from '../../../../lib/cartStore'
import { toast } from '../../../../lib/toast'
import { colors, radius, shadows } from '../../../../theme'

// What a wishlisted product's availability means for the card.
const AVAILABILITY = {
  AVAILABLE: { label: 'In stock', color: colors.emerald[600], canBuy: true },
  LOW_STOCK: { label: null, color: colors.amber[600], canBuy: true },
  OUT_OF_STOCK: { label: 'Out of stock', color: colors.red[600], canBuy: false },
  UNAVAILABLE: { label: 'No longer available', color: colors.red[600], canBuy: false },
}

export function WishlistScreen() {
  const router = useRouter()
  const wishlistItems = useWishlistStore((state) => state.items)
  const isSyncing = useWishlistStore((state) => state.isSyncing)
  const notice = useWishlistStore((state) => state.notice)
  const clearNotice = useWishlistStore((state) => state.clearNotice)
  const removeFromWishlist = useWishlistStore((state) => state.removeItem)
  const hydrate = useWishlistStore((state) => state.hydrate)
  const addToCart = useCartStore((state) => state.addItem)

  const [movingId, setMovingId] = useState(null)
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)

  // Re-read on mount so prices, stock and availability are current rather than whatever was
  // cached on this device the last time the list was opened.
  useEffect(() => {
    hydrate().finally(() => setHasLoadedOnce(true))
  }, [hydrate])

  const goBack = () => {
    if (router.canGoBack()) router.back()
    else router.replace(USER_ROUTES.DASHBOARD)
  }

  const moveToCart = async (item) => {
    if (movingId) return
    setMovingId(item.id)
    const result = await addToCart(item)
    setMovingId(null)
    // Only drop it from the wishlist once it is genuinely in the cart - otherwise a failed add
    // silently loses the item from both places.
    if (result?.ok) {
      removeFromWishlist(item.id)
      toast.success('Moved to Bag', `${item.name} moved to your shopping cart.`)
      router.push(USER_ROUTES.CART)
    } else {
      toast.error('Could not move to cart', result?.error)
    }
  }

  const showSkeleton = isSyncing && !hasLoadedOnce && wishlistItems.length === 0

  const header = (
    <View style={styles.topBar}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
        <Pressable onPress={goBack} accessibilityLabel="Go back" style={styles.backBtn}>
          <Icon name="HiArrowLeft" size={20} color={colors.slate[800]} />
        </Pressable>
        <Text noTranslate={false} style={{ fontSize: 16, fontWeight: '700', color: colors.slate[900] }}>
          {`My Wishlist${wishlistItems.length > 0 ? ` (${wishlistItems.length})` : ''}`}
        </Text>
      </View>
      {wishlistItems.length > 0 ? (
        <Pressable
          // Removes each item through the store so the server is updated too.
          onPress={() => wishlistItems.forEach((item) => removeFromWishlist(item.id))}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
        >
          <Icon name="HiTrash" size={16} color={colors.red[600]} />
          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.red[600] }}>Clear all</Text>
        </Pressable>
      ) : null}
    </View>
  )

  const renderItem = ({ item }) => {
    const state = AVAILABILITY[item.availability] || AVAILABILITY.AVAILABLE
    const label = item.availability === 'LOW_STOCK' && item.availableStock ? `Only ${item.availableStock} left` : state.label

    return (
      <Pressable
        onPress={() => router.push(userPath.product(item.id))}
        style={[styles.card, shadows.sm]}
      >
        <Pressable
          onPress={() => {
            removeFromWishlist(item.id)
            toast.info('Removed from Wishlist', `${item.name} was removed from your wishlist.`)
          }}
          accessibilityLabel={`Remove ${item.name} from wishlist`}
          style={[styles.heart, shadows.sm]}
        >
          <Icon name="HiHeart" size={16} color={colors.red[500]} />
        </Pressable>

        <View style={[{ borderRadius: radius.xl, overflow: 'hidden' }, !state.canBuy && { opacity: 0.6 }]}>
          <SmartImage src={item.image} alt={item.name} ratio={1} fit="contain" />
        </View>

        <View style={{ gap: 4, marginTop: 12 }}>
          {label ? (
            <Text style={{ fontSize: 10, fontWeight: '700', color: state.color }}>{label}</Text>
          ) : null}
          <Text noTranslate numberOfLines={2} style={{ minHeight: 36, fontSize: 12, lineHeight: 18, fontWeight: '700', color: colors.slate[900] }}>
            {item.name}
          </Text>
          {item.subtitle ? (
            <Text noTranslate numberOfLines={1} style={{ fontSize: 11, fontWeight: '500', color: colors.slate[400] }}>
              {item.subtitle}
            </Text>
          ) : null}

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingTop: 6 }}>
            <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 6 }}>
              <Text noTranslate style={{ fontSize: 12, fontWeight: '800', color: colors.slate[900] }}>
                {'₹'}
                {item.price.toLocaleString('en-IN')}
              </Text>
              {item.originalPrice > item.price ? (
                <Text noTranslate style={{ fontSize: 11, color: colors.slate[400], textDecorationLine: 'line-through' }}>
                  {'₹'}
                  {item.originalPrice.toLocaleString('en-IN')}
                </Text>
              ) : null}
            </View>
            <Pressable
              onPress={() => moveToCart(item)}
              disabled={!state.canBuy || movingId === item.id}
              accessibilityLabel={`Move ${item.name} to cart`}
              style={({ pressed }) => [
                styles.cartBtn,
                { backgroundColor: pressed ? colors.blue[600] : colors.blue[50], opacity: !state.canBuy || movingId === item.id ? 0.4 : 1 },
              ]}
            >
              <Icon name="HiOutlineShoppingBag" size={16} color={colors.blue[600]} />
            </Pressable>
          </View>
        </View>
      </Pressable>
    )
  }

  const listHeader = notice ? (
    <View style={styles.notice}>
      <Text style={{ flex: 1, fontSize: 12, fontWeight: '600', color: colors.amber[800] }}>{notice}</Text>
      <Pressable onPress={clearNotice}>
        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.amber[800], textDecorationLine: 'underline' }}>Dismiss</Text>
      </Pressable>
    </View>
  ) : null

  return (
    <Screen tab scroll={false} header={header}>
      {showSkeleton ? (
        <View style={{ padding: 16 }}>
          {listHeader}
          <ProductGridSkeleton count={8} />
        </View>
      ) : wishlistItems.length === 0 ? (
        <View style={{ padding: 16, gap: 16 }}>
          {listHeader}
          <EmptyResult
            icon={'❤️'}
            title="Your wishlist is empty"
            description="Tap the heart on any product to save it here for later."
            action={
              <Pressable
                onPress={() => router.push(USER_ROUTES.LISTING)}
                style={({ pressed }) => [styles.explore, shadows.sm, { backgroundColor: pressed ? colors.blue[700] : colors.blue[600] }]}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>Explore products</Text>
              </Pressable>
            }
          />
        </View>
      ) : (
        <FlatList
          data={wishlistItems}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          numColumns={2}
          columnWrapperStyle={{ gap: 12 }}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          ListHeaderComponent={listHeader}
          showsVerticalScrollIndicator={false}
        />
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[200],
    ...shadows.sm,
  },
  backBtn: { height: 36, width: 36, alignItems: 'center', justifyContent: 'center', borderRadius: radius.lg },
  card: {
    flex: 1,
    maxWidth: '48.5%',
    backgroundColor: '#fff',
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.8)',
    padding: 14,
  },
  heart: {
    position: 'absolute',
    right: 10,
    top: 10,
    zIndex: 10,
    height: 36,
    width: 36,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: colors.slate[200],
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBtn: { height: 36, width: 36, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.amber[200],
    backgroundColor: colors.amber[50],
    padding: 14,
    marginBottom: 16,
  },
  explore: { borderRadius: radius.xl, paddingHorizontal: 20, paddingVertical: 10 },
})
