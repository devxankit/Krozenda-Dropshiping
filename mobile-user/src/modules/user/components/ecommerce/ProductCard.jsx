import { memo } from 'react'
import { StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Icon } from '../../../../components/ui/Icon'
import { SmartImage } from '../../../../components/ui/SmartImage'
import { Animated, PressableScale, usePop } from '../../../../components/ui/motion'
import { Text } from '../../../../components/ui/Text'
import { userPath } from '../../../../config/routes'
import { useAuthStore } from '../../../../lib/authStore'
import { useWishlistStore } from '../../../../lib/wishlistStore'
import { toast } from '../../../../lib/toast'
import { colors, radius, shadows } from '../../../../theme'

function formatPrice(value) {
  return `₹${Number(value ?? 0).toLocaleString('en-IN')}`
}

// Props match the web card (product, layout, priority). `style` replaces className, `priority` is
// kept for call-site parity (SmartImage loads natively and does not need the hint).
function ProductCardBase({ product, layout = 'grid', priority = false, style }) {
  const router = useRouter()
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const isWishlisted = useWishlistStore((state) => state.items.some((item) => item.id === product.id))
  const toggleWishlistItem = useWishlistStore((state) => state.toggleItem)

  const price = product.salePrice ?? product.price
  const hasDiscount = product.salePrice != null && product.salePrice < product.price
  const discountPercent =
    product.discountPercent > 0
      ? product.discountPercent
      : hasDiscount
        ? Math.round(((product.price - product.salePrice) / product.price) * 100)
        : 0

  const outOfStock = product.stock <= 0
  const lowStock = !outOfStock && product.stock > 0 && product.stock <= 5

  const subtitle = product.brand?.name || product.category?.name || ''

  const popStyle = usePop(isWishlisted)
  const imageWidth = layout === 'list' ? 96 : 160
  const open = () => router.push(userPath.product(product.id))

  const handleWishlist = () => {
    const wasWishlisted = isWishlisted
    toggleWishlistItem({
      id: product.id,
      name: product.name,
      subtitle,
      image: product.image || '/images/default-product.png',
      imageSrcSet: product.imageSrcSet,
      price,
      originalPrice: product.price,
    })
    if (wasWishlisted) {
      toast.info('Removed from Wishlist', `${product.name} removed from your saved items.`)
    } else {
      toast.success('Saved to Wishlist', `${product.name} added to your wishlist.`)
    }
  }

  const wishlistButton = isAuthenticated ? (
    <PressableScale
      onPress={handleWishlist}
      scaleTo={0.85}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={isWishlisted ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
      accessibilityState={{ selected: isWishlisted }}
      style={[styles.heart, shadows.xs]}
    >
      <Animated.View style={popStyle}>
        {isWishlisted ? (
          <Icon name="HiHeart" size={14} color={colors.red[500]} />
        ) : (
          <Icon name="HiOutlineHeart" size={14} color={colors.slate[600]} />
        )}
      </Animated.View>
    </PressableScale>
  ) : null

  const priceBlock = (
    <View style={styles.priceBlock}>
      <View style={styles.priceRow}>
        <Text noTranslate style={styles.price}>
          {formatPrice(price)}
        </Text>
        {hasDiscount ? (
          <Text noTranslate style={styles.mrp}>
            {formatPrice(product.price)}
          </Text>
        ) : null}
        {discountPercent > 0 ? (
          <View style={styles.offBadge}>
            <Text noTranslate style={styles.offText}>
              {discountPercent}% OFF
            </Text>
          </View>
        ) : null}
      </View>
      {outOfStock ? (
        <Text style={[styles.note, { fontWeight: '600', color: colors.red[600] }]}>Out of stock</Text>
      ) : lowStock ? (
        <Text style={[styles.note, { fontWeight: '500', color: colors.amber[600] }]}>
          {`Only ${product.stock} left`}
        </Text>
      ) : null}
    </View>
  )

  const ratingBadge =
    product.rating > 0 && product.reviewsCount > 0 ? (
      <View style={styles.ratingRow}>
        <Icon name="HiStar" size={14} color={colors.amber[400]} />
        <Text noTranslate style={styles.ratingValue}>
          {product.rating.toFixed(1)}
        </Text>
        <Text noTranslate style={styles.ratingCount}>
          {`(${product.reviewsCount.toLocaleString('en-IN')})`}
        </Text>
      </View>
    ) : null

  if (layout === 'list') {
    return (
      <PressableScale onPress={open} scaleTo={0.985} accessibilityRole="link" style={[styles.listCard, shadows.card, style]}>
        <View style={styles.listImage}>
          <SmartImage src={product.image} srcSet={product.imageSrcSet} displayWidth={imageWidth} alt={product.name} ratio="1 / 1" priority={priority} />
        </View>
        <View style={styles.listInfo}>
          {product.isDropship ? (
            <View style={styles.dropshipInline}>
              <Text style={styles.dropshipInlineText}>Dropship</Text>
            </View>
          ) : null}
          {ratingBadge}
          <Text numberOfLines={2} style={styles.listTitle}>
            {product.name}
          </Text>
          {subtitle ? (
            <Text numberOfLines={1} style={styles.listSubtitle}>
              {subtitle}
            </Text>
          ) : null}
          {priceBlock}
        </View>
        {wishlistButton}
      </PressableScale>
    )
  }

  return (
    <PressableScale onPress={open} scaleTo={0.97} accessibilityRole="link" style={[styles.card, shadows.card, style]}>
      <View style={styles.imageWrap}>
        {wishlistButton}
        {product.isDropship ? (
          <View style={styles.dropshipBadge}>
            <Text style={styles.dropshipBadgeText}>Dropship</Text>
          </View>
        ) : null}
        <SmartImage src={product.image} srcSet={product.imageSrcSet} displayWidth={imageWidth} alt={product.name} ratio="1 / 1" priority={priority} />
        {outOfStock ? (
          <View pointerEvents="none" style={styles.oosOverlay}>
            <View style={styles.oosPill}>
              <Text style={styles.oosText}>Out of stock</Text>
            </View>
          </View>
        ) : null}
      </View>

      <View style={styles.info}>
        <Text numberOfLines={2} style={styles.title}>
          {product.name}
        </Text>
        {subtitle ? (
          <Text numberOfLines={1} style={styles.subtitle}>
            {subtitle}
          </Text>
        ) : null}
        {ratingBadge}
        {priceBlock}
      </View>
    </PressableScale>
  )
}

// Cards are rendered by the hundred in grids; re-render only when the product object (stable from the
// query cache) or the layout actually changes.
export const ProductCard = memo(ProductCardBase)

const styles = StyleSheet.create({
  card: {
    justifyContent: 'space-between',
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.7)',
    backgroundColor: '#fff',
    padding: 10,
  },
  imageWrap: {
    overflow: 'hidden',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(241,245,249,0.9)',
    backgroundColor: 'rgba(248,250,252,0.5)',
  },
  heart: {
    position: 'absolute',
    right: 8,
    top: 8,
    zIndex: 10,
    height: 28,
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.7)',
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  dropshipBadge: {
    position: 'absolute',
    left: 8,
    top: 8,
    zIndex: 10,
    borderRadius: 9999,
    backgroundColor: 'rgba(79,70,229,0.9)',
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  dropshipBadgeText: { fontSize: 10, fontWeight: '600', letterSpacing: 0.25, color: '#fff', textTransform: 'uppercase' },
  oosOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.xl,
    backgroundColor: 'rgba(15,23,42,0.4)',
  },
  oosPill: {
    borderRadius: 9999,
    backgroundColor: 'rgba(15,23,42,0.9)',
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  oosText: { fontSize: 10, fontWeight: '600', letterSpacing: 0.5, color: '#fff', textTransform: 'uppercase' },
  info: { marginTop: 10, gap: 4 },
  title: { fontSize: 12, lineHeight: 16.5, fontWeight: '600', color: colors.slate[800] },
  subtitle: { fontSize: 11, lineHeight: 16, fontWeight: '500', color: colors.slate[400] },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingValue: { fontSize: 11, lineHeight: 16, fontWeight: '700', color: colors.slate[800] },
  ratingCount: { fontSize: 11, lineHeight: 16, fontWeight: '400', color: colors.slate[400] },
  priceBlock: { paddingTop: 6, gap: 2 },
  priceRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 6, rowGap: 2 },
  price: { fontSize: 14, lineHeight: 20, fontWeight: '700', letterSpacing: -0.35, color: colors.slate[900] },
  mrp: { fontSize: 12, lineHeight: 16, fontWeight: '400', color: colors.slate[400], textDecorationLine: 'line-through' },
  offBadge: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(167,243,208,0.6)',
    backgroundColor: colors.emerald[50],
    paddingHorizontal: 6,
  },
  offText: { fontSize: 10, lineHeight: 16, fontWeight: '600', color: colors.emerald[700] },
  note: { fontSize: 11, lineHeight: 16 },

  // list layout
  listCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.7)',
    backgroundColor: '#fff',
    padding: 14,
  },
  listImage: {
    width: 96,
    overflow: 'hidden',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.slate[100],
  },
  listInfo: { flex: 1, minWidth: 0, gap: 4 },
  dropshipInline: {
    alignSelf: 'flex-start',
    borderRadius: 9999,
    backgroundColor: colors.indigo[50],
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  dropshipInlineText: { fontSize: 10, fontWeight: '600', letterSpacing: 0.25, color: colors.indigo[700], textTransform: 'uppercase' },
  listTitle: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: colors.slate[800] },
  listSubtitle: { fontSize: 12, lineHeight: 16, fontWeight: '500', color: colors.slate[400] },
})
