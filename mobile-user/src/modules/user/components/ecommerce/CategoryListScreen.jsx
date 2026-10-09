import { useState } from 'react'
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Screen } from '../../../../components/layout/Screen'
import { Icon } from '../../../../components/ui/Icon'
import { Animated, enterFade } from '../../../../components/ui/motion'
import { SmartImage } from '../../../../components/ui/SmartImage'
import { Text } from '../../../../components/ui/Text'
import { Skeleton } from '../../../../components/ui/Skeleton'
import { USER_ROUTES, userPath } from '../../../../config/routes'
import { useCartCount } from '../../../../lib/cartStore'
import { useT } from '../../../../lib/i18n'
import { colors, fontFamilyFor, radius, shadows } from '../../../../theme'
import { useCategoriesController } from '../../controllers/useProductsController'

function formatProductCount(count) {
  if (!count) return 'New catalog'
  return `${count.toLocaleString('en-IN')} Product${count === 1 ? '' : 's'}`
}

function getCategoryBadge(cat) {
  if (cat.isTopCategory) return 'TOP CATEGORY'
  if (cat.maxDiscountPercent >= 50) return 'MEGA DEAL'
  if (cat.maxDiscountPercent >= 30) return 'HOT DEAL'
  if (cat.productCount > 0) return 'IN STOCK'
  return null
}

// Keeps a lone last card at half width, like the web grid.
const SPACER = { id: '__spacer' }

const FILTER_CHIPS = [
  { id: 'all', label: 'All Categories' },
  { id: 'top', label: 'Top Categories' },
]

export function CategoryListScreen() {
  const router = useRouter()
  const t = useT()
  const cartCount = useCartCount()
  const [selectedFilter, setSelectedFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const { categories, isLoading, refetch } = useCategoriesController()
  const [refreshing, setRefreshing] = useState(false)

  const filteredCategories = categories.filter((cat) => {
    const matchesFilter = selectedFilter === 'all' || (selectedFilter === 'top' && cat.isTopCategory)
    const matchesSearch = searchQuery.trim() === '' || cat.name.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesFilter && matchesSearch
  })
  const topCount = categories.filter((cat) => cat.isTopCategory).length
  const noTopCategories = selectedFilter === 'top' && topCount === 0

  const handleCategoryClick = (cat) => {
    // In the route params, so the filtered listing is a real deep link.
    router.push(userPath.listing({ category: cat.id || cat._id }))
  }

  const onRefresh = async () => {
    setRefreshing(true)
    try {
      await refetch()
    } finally {
      setRefreshing(false)
    }
  }

  const header = (
    <View style={styles.headerCard}>
      <View style={styles.titleRow}>
        <Pressable
          onPress={() => router.replace(USER_ROUTES.DASHBOARD)}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={({ pressed }) => [styles.backBtn, pressed && { backgroundColor: colors.slate[100] }]}
        >
          <Icon name="HiArrowLeft" size={20} color={colors.slate[700]} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <View style={styles.pillRow}>
            <View style={styles.countPill}>
              <Text style={styles.countPillText}>
                {`All Categories (${categories.length})`}
              </Text>
            </View>
            <View style={styles.factoryRow}>
              <Icon name="HiCheckBadge" size={16} color={colors.emerald[500]} />
              <Text style={styles.factoryText}>Factory Direct</Text>
            </View>
          </View>
          <Text style={styles.h1}>Explore All Categories</Text>
          <Text style={styles.sub}>Browse complete wholesale & dropshipping product collections.</Text>
        </View>
      </View>

      <View style={styles.searchRow}>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <View pointerEvents="none" style={styles.searchIcon}>
            <Icon name="HiMagnifyingGlass" size={16} color={colors.slate[400]} />
          </View>
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t('Search all categories...')}
            placeholderTextColor={colors.slate[400]}
            style={styles.searchInput}
          />
        </View>
        <Pressable
          onPress={() => router.push(USER_ROUTES.CART)}
          accessibilityRole="button"
          accessibilityLabel={cartCount > 0 ? `Cart, ${cartCount} items` : 'Cart'}
          style={({ pressed }) => [styles.cartBtn, pressed && { backgroundColor: colors.slate[200] }]}
        >
          <Icon name="HiOutlineShoppingBag" size={20} color={colors.slate[700]} />
          {cartCount > 0 ? (
            <View style={styles.cartBadge}>
              <Text noTranslate style={styles.cartBadgeText}>
                {cartCount > 9 ? '9+' : cartCount}
              </Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {FILTER_CHIPS.map((chip) => {
          const active = selectedFilter === chip.id
          return (
            <Pressable
              key={chip.id}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => setSelectedFilter(chip.id)}
              style={[styles.chip, active ? styles.chipActive : styles.chipIdle, active && shadows.md]}
            >
              <Text style={[styles.chipText, { color: active ? '#fff' : colors.slate[600] }]}>
                {`${chip.label} (${chip.id === 'top' ? topCount : categories.length})`}
              </Text>
            </Pressable>
          )
        })}
      </ScrollView>
    </View>
  )

  const empty = isLoading ? (
    <View style={styles.skeletonGrid}>
      {[1, 2, 3, 4, 5, 6].map((n) => (
        <View key={n} style={styles.skeletonCard}>
          <Skeleton style={{ height: 16, width: 64, borderRadius: radius.md, backgroundColor: colors.slate[200] }} />
          <Skeleton style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: radius.xl, backgroundColor: colors.slate[200] }} />
          <Skeleton style={{ height: 24, width: '100%', borderRadius: radius.lg, backgroundColor: colors.slate[200] }} />
          <Skeleton style={{ height: 12, width: '75%', borderRadius: radius.md, backgroundColor: colors.slate[200] }} />
        </View>
      ))}
    </View>
  ) : (
    <View style={styles.emptyCard}>
      <Icon name="HiOutlineSquares2X2" size={36} color={colors.slate[300]} />
      <Text style={styles.emptyTitle}>
        {categories.length === 0
          ? 'No categories published yet'
          : noTopCategories
            ? 'No top categories yet'
            : 'No categories match your search'}
      </Text>
      <Text style={styles.emptyBody}>
        {categories.length === 0
          ? 'Check back soon — new wholesale categories are added regularly.'
          : noTopCategories
            ? 'Top picks will show up here once they are featured.'
            : 'Try a different search term or filter.'}
      </Text>
      {categories.length > 0 ? (
        <Pressable
          onPress={() => {
            setSelectedFilter('all')
            setSearchQuery('')
          }}
        >
          <Text style={styles.emptyLink}>View all categories</Text>
        </Pressable>
      ) : null}
    </View>
  )

  const footer = (
    <View style={styles.callout}>
      <View style={styles.calloutRow}>
        <View style={styles.calloutIcon}>
          <Icon name="HiBuildingStorefront" size={24} color={colors.amber[600]} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.calloutTitle}>Looking for Custom B2B Sourcing?</Text>
          <Text style={styles.calloutBody}>Get direct factory quotes, unbranded packaging, and custom bulk tiers.</Text>
        </View>
      </View>
      <Pressable
        onPress={() => router.push(USER_ROUTES.SUPPORT)}
        style={({ pressed }) => [styles.calloutBtn, shadows.sm, pressed && { backgroundColor: colors.slate[800] }]}
      >
        <Text style={styles.calloutBtnText}>Contact B2B Team</Text>
      </Pressable>
    </View>
  )

  const renderItem = ({ item: cat, index }) => {
    if (cat === SPACER) return <View style={{ flex: 1 }} />
    const badge = getCategoryBadge(cat)
    return (
      <Animated.View entering={index < 6 ? enterFade(index) : undefined} style={{ flex: 1 }}>
      <Pressable
        onPress={() => handleCategoryClick(cat)}
        style={({ pressed }) => [styles.card, shadows['2xs'], pressed && { borderColor: colors.blue[400] }]}
      >
        {({ pressed }) => (
          <>
            {badge ? (
              <View style={styles.badgeRow}>
                <View style={[styles.badge, pressed && { backgroundColor: colors.blue[600] }]}>
                  <Text style={[styles.badgeText, pressed && { color: '#fff' }]}>{badge}</Text>
                </View>
              </View>
            ) : null}

            {/* A category with no image on file gets a neutral placeholder in a fixed-ratio box. */}
            <SmartImage
              src={cat.image}
              alt={cat.name}
              ratio="4 / 3"
              fit="cover"
              style={{ marginVertical: 4, width: '100%', borderRadius: radius.xl }}
            />

            {cat.maxDiscountPercent > 0 ? (
              <View style={{ marginTop: 4 }}>
                <View style={[styles.offer, pressed && { backgroundColor: colors.blue[50], borderColor: colors.blue[200] }]}>
                  <Text numberOfLines={1} style={[styles.offerText, pressed && { color: colors.blue[700] }]}>
                    {`Up to ${cat.maxDiscountPercent}% OFF`}
                  </Text>
                </View>
              </View>
            ) : null}

            <View style={styles.titleBlock}>
              <Text noTranslate numberOfLines={1} style={[styles.name, pressed && { color: colors.blue[600] }]}>
                {cat.name}
              </Text>
              <View style={styles.countRow}>
                <Text noTranslate numberOfLines={1} style={styles.count}>
                  {formatProductCount(cat.productCount)}
                </Text>
                <Icon
                  name="HiArrowRight"
                  size={14}
                  color={pressed ? colors.blue[600] : colors.slate[400]}
                  style={{ marginLeft: 4 }}
                />
              </View>
            </View>
          </>
        )}
      </Pressable>
      </Animated.View>
    )
  }

  return (
    <Screen tab scroll={false}>
      <FlatList
        data={isLoading ? [] : filteredCategories.length % 2 ? [...filteredCategories, SPACER] : filteredCategories}
        keyExtractor={(cat) => cat.id}
        renderItem={renderItem}
        numColumns={2}
        columnWrapperStyle={{ gap: 16 }}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={Separator}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={footer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      />
    </Screen>
  )
}

function Separator() {
  return <View style={{ height: 16 }} />
}

const styles = StyleSheet.create({
  listContent: { paddingHorizontal: 12, paddingTop: 16, paddingBottom: 16 },
  headerCard: {
    gap: 16,
    marginBottom: 24,
    borderRadius: radius['3xl'],
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.9)',
    backgroundColor: '#fff',
    padding: 16,
    ...shadows.sm,
  },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  backBtn: { padding: 8, borderRadius: radius.xl },
  pillRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  countPill: { borderRadius: 9999, backgroundColor: colors.blue[100], paddingHorizontal: 10, paddingVertical: 2 },
  countPillText: { fontSize: 10, lineHeight: 16, fontWeight: '800', letterSpacing: 0.25, color: colors.blue[700], textTransform: 'uppercase' },
  factoryRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  factoryText: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: colors.emerald[600] },
  h1: { marginTop: 4, fontSize: 20, lineHeight: 28, fontWeight: '800', letterSpacing: -0.5, color: colors.slate[900] },
  sub: { marginTop: 2, fontSize: 12, lineHeight: 16, color: colors.slate[500] },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  searchIcon: { position: 'absolute', left: 12, zIndex: 1 },
  searchInput: {
    paddingLeft: 36,
    paddingRight: 12,
    paddingVertical: 8,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.slate[200],
    backgroundColor: colors.slate[100],
    fontSize: 12,
    fontFamily: fontFamilyFor('500'),
    color: colors.slate[800],
  },
  cartBtn: {
    padding: 8,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.8)',
    backgroundColor: colors.slate[100],
  },
  cartBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    height: 16,
    width: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9999,
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: colors.amber[500],
  },
  cartBadgeText: { fontSize: 9, fontWeight: '800', color: '#fff' },
  chipRow: { alignItems: 'center', gap: 8, paddingTop: 8, paddingBottom: 4 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.xl },
  chipActive: { backgroundColor: colors.blue[600] },
  chipIdle: { backgroundColor: colors.slate[100], borderWidth: 1, borderColor: 'rgba(226,232,240,0.6)' },
  chipText: { fontSize: 12, lineHeight: 16, fontWeight: '800' },

  skeletonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  skeletonCard: {
    width: '47%',
    flexGrow: 1,
    gap: 8,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.9)',
    backgroundColor: '#fff',
    padding: 14,
  },
  emptyCard: {
    alignItems: 'center',
    gap: 8,
    borderRadius: radius['3xl'],
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.slate[300],
    backgroundColor: '#fff',
    padding: 40,
  },
  emptyTitle: { fontSize: 14, lineHeight: 20, fontWeight: '700', color: colors.slate[700], textAlign: 'center' },
  emptyBody: { fontSize: 12, lineHeight: 16, color: colors.slate[500], textAlign: 'center', maxWidth: 384 },
  emptyLink: { marginTop: 4, fontSize: 12, lineHeight: 16, fontWeight: '700', color: colors.blue[600] },

  card: {
    flex: 1,
    justifyContent: 'space-between',
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.9)',
    backgroundColor: '#fff',
    padding: 14,
  },
  badgeRow: { flexDirection: 'row', alignItems: 'center', width: '100%', marginBottom: 4 },
  badge: { borderRadius: radius.md, backgroundColor: colors.slate[100], paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 9, lineHeight: 16, fontWeight: '800', letterSpacing: 0.45, color: colors.slate[600], textTransform: 'uppercase' },
  offer: {
    width: '100%',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.6)',
    backgroundColor: colors.slate[50],
    paddingVertical: 4,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  offerText: { fontSize: 10, lineHeight: 16, fontWeight: '700', letterSpacing: -0.25, color: colors.slate[700] },
  titleBlock: { marginTop: 8, paddingTop: 10, gap: 2, borderTopWidth: 1, borderTopColor: colors.slate[100] },
  name: { fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: -0.3, color: colors.slate[900] },
  countRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  count: { flex: 1, fontSize: 11, lineHeight: 16, fontWeight: '500', color: colors.slate[500] },

  callout: {
    marginTop: 24,
    alignItems: 'center',
    gap: 16,
    borderRadius: radius['3xl'],
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.8)',
    backgroundColor: '#fff',
    padding: 24,
    ...shadows.xs,
  },
  calloutRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  calloutIcon: {
    height: 48,
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: 'rgba(253,230,138,0.8)',
    backgroundColor: colors.amber[50],
  },
  calloutTitle: { fontSize: 14, lineHeight: 20, fontWeight: '800', color: colors.slate[900] },
  calloutBody: { fontSize: 12, lineHeight: 16, color: colors.slate[500] },
  calloutBtn: { borderRadius: radius.xl, backgroundColor: colors.slate[900], paddingHorizontal: 20, paddingVertical: 10 },
  calloutBtnText: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: '#fff' },
})
