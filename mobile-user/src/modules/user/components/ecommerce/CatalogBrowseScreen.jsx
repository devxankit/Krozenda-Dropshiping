import { useEffect, useMemo, useRef, useState } from 'react'
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native'
import Animated from 'react-native-reanimated'
import { PressableScale, enterFade } from '../../../../components/ui/motion'
import { useRouter } from 'expo-router'
import { Screen } from '../../../../components/layout/Screen'
import { EmptyResult, ErrorState, ProductGridSkeleton } from '../../../../components/ui/AsyncBoundary'
import { Icon } from '../../../../components/ui/Icon'
import { Sheet } from '../../../../components/ui/Sheet'
import { Text } from '../../../../components/ui/Text'
import { USER_ROUTES } from '../../../../config/routes'
import { useCatalogParams } from '../../../../lib/useCatalogParams'
import { useT } from '../../../../lib/i18n'
import { colors, fontFamilyFor, radius, shadows } from '../../../../theme'
import {
  useBrandsController,
  useCategoriesController,
  useProductsController,
} from '../../controllers/useProductsController'
import { ProductCard } from './ProductCard'
import { CatalogFilterPanel, FilterSheet } from './CatalogFilterPanel'

// One screen behind both /listing and /search: a filtered product grid with server-side
// filtering/sorting/pagination, all state in the route's query string.

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'popular', label: 'Popularity' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'discount', label: 'Discount' },
  { value: 'rating', label: 'Customer rating' },
]

// 350ms: long enough that a normal typing cadence produces one request per word rather than one
// per keystroke, short enough that the results do not feel detached from the input. Superseded
// requests are aborted by react-query (signal threaded to axios in productService).
const SEARCH_DEBOUNCE_MS = 350

export function CatalogBrowseScreen({ mode = 'listing' }) {
  const router = useRouter()
  const t = useT()
  const listRef = useRef(null)
  const { params, apiParams, setParams, clearFilters, activeFilterCount } = useCatalogParams()

  const [isFilterSheetOpen, setFilterSheetOpen] = useState(false)
  const [isSortOpen, setSortOpen] = useState(false)
  const [searchFocused, setSearchFocused] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  // The input is uncontrolled-by-route while typing: the params (and therefore the request) only
  // catch up after the debounce, so every keystroke is not a network call.
  const [searchDraft, setSearchDraft] = useState(params.search)
  const searchDraftRef = useRef(params.search)

  useEffect(() => {
    // Keep the box in sync when the params change for a reason other than typing.
    if (params.search !== searchDraftRef.current) {
      searchDraftRef.current = params.search
      setSearchDraft(params.search)
    }
  }, [params.search])

  useEffect(() => {
    if (searchDraft === params.search) return undefined
    const timer = setTimeout(() => {
      searchDraftRef.current = searchDraft
      setParams({ search: searchDraft })
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [searchDraft, params.search, setParams])

  const { categories } = useCategoriesController()
  const { brands } = useBrandsController()
  const { products, pagination, isLoading, isFetching, error, refetch } = useProductsController(apiParams)

  const activeCategory = categories.find((c) => c.id === params.category)

  const heading = useMemo(() => {
    if (params.search) return `Results for “${params.search}”`
    if (activeCategory) return activeCategory.name
    if (params.flashSale) return 'Flash Sale'
    if (params.trending) return 'Trending Now'
    return 'All Products'
  }, [params.search, params.flashSale, params.trending, activeCategory])

  const scrollTop = (animated) => listRef.current?.scrollToOffset({ offset: 0, animated })

  // Any category change in the browse view resets to the absolute top.
  useEffect(() => {
    scrollTop(false)
  }, [params.category])

  const goToPage = (page) => {
    setParams({ page }, { resetPage: false })
    scrollTop(true)
  }

  const goBack = () => {
    if (router.canGoBack()) router.back()
    else router.replace(USER_ROUTES.DASHBOARD)
  }

  const onRefresh = async () => {
    setRefreshing(true)
    try {
      await refetch()
    } finally {
      setRefreshing(false)
    }
  }

  const sortLabel = SORT_OPTIONS.find((o) => o.value === params.sort)?.label ?? SORT_OPTIONS[0].label

  const topBar = (
    <View style={styles.topBarWrap}>
      <View style={[styles.topBar, shadows.sm]}>
        <Pressable
          onPress={goBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={4}
          style={({ pressed }) => [styles.backBtn, pressed && { backgroundColor: colors.slate[100] }]}
        >
          <Icon name="HiArrowLeft" size={20} color={colors.slate[700]} />
        </Pressable>

        <View
          style={[
            styles.searchBox,
            searchFocused && { backgroundColor: '#fff', borderColor: colors.blue[600], borderWidth: 2 },
          ]}
        >
          <Icon name="HiMagnifyingGlass" size={16} color={colors.slate[400]} />
          <TextInput
            value={searchDraft}
            onChangeText={setSearchDraft}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder={t('Search products, brands...')}
            placeholderTextColor={colors.slate[400]}
            returnKeyType="search"
            autoCorrect={false}
            accessibilityLabel="Search products"
            style={styles.searchInput}
          />
          {searchDraft ? (
            <Pressable
              onPress={() => setSearchDraft('')}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              hitSlop={8}
              style={styles.clearBtn}
            >
              <Icon name="HiXMark" size={16} color={colors.slate[400]} />
            </Pressable>
          ) : null}
        </View>

        <PressableScale
          onPress={() => setFilterSheetOpen(true)}
          scaleTo={0.94}
          accessibilityRole="button"
          accessibilityLabel={activeFilterCount > 0 ? `Filters, ${activeFilterCount} active` : 'Filters'}
          style={[styles.filterBtn, shadows.sm]}
        >
          <Icon name="HiAdjustmentsHorizontal" size={16} color="#fff" />
          <Text style={styles.filterText}>Filters</Text>
          {activeFilterCount > 0 ? (
            <View style={styles.filterCount}>
              <Text noTranslate style={styles.filterCountText}>
                {activeFilterCount}
              </Text>
            </View>
          ) : null}
        </PressableScale>
      </View>
    </View>
  )

  const brandName = (brandId) => brands.find((b) => b.id === brandId)?.name || 'Brand'

  const resultsHeader = (
    <View style={{ gap: 16 }}>
      <View style={[styles.resultsCard, shadows.sm]}>
        <View style={{ flexShrink: 1, minWidth: 0 }}>
          <Text noTranslate={Boolean(params.search || activeCategory)} numberOfLines={1} style={styles.heading}>
            {heading}
          </Text>
          <Text style={styles.count} accessibilityLiveRegion="polite">
            {isLoading
              ? 'Loading…'
              : pagination
                ? `${pagination.total.toLocaleString('en-IN')} ${pagination.total === 1 ? 'product' : 'products'}`
                : ''}
          </Text>
        </View>

        <View style={styles.sortWrap}>
          <Text style={styles.sortLabel}>Sort</Text>
          <Pressable
            onPress={() => setSortOpen(true)}
            accessibilityLabel="Sort"
            style={({ pressed }) => [styles.sortSelect, pressed && { backgroundColor: colors.slate[50] }]}
          >
            <Text numberOfLines={1} style={styles.sortValue}>
              {sortLabel}
            </Text>
            <Icon name="HiChevronDown" size={14} color={colors.slate[500]} />
          </Pressable>
        </View>
      </View>

      {/* Active filter chips - so the user can always see WHY a result set is small, and undo one
          filter without opening the panel. */}
      {activeFilterCount > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.activeChips}
          style={{ marginHorizontal: -16 }}
          keyboardShouldPersistTaps="handled"
        >
          {params.brands.map((brandId) => (
            <FilterChip
              key={brandId}
              label={brandName(brandId)}
              onRemove={() => setParams({ brands: params.brands.filter((b) => b !== brandId) })}
            />
          ))}
          {params.minPrice != null || params.maxPrice != null ? (
            <FilterChip
              label={`₹${params.minPrice ?? 0} – ₹${params.maxPrice ?? '∞'}`}
              onRemove={() => setParams({ minPrice: null, maxPrice: null })}
            />
          ) : null}
          {params.rating ? (
            <FilterChip label={`${params.rating}★ & above`} onRemove={() => setParams({ rating: null })} />
          ) : null}
          {params.minDiscount ? (
            <FilterChip label={`${params.minDiscount}%+ off`} onRemove={() => setParams({ minDiscount: null })} />
          ) : null}
          {params.inStock ? <FilterChip label="In stock" onRemove={() => setParams({ inStock: false })} /> : null}
          {params.flashSale ? <FilterChip label="Flash sale" onRemove={() => setParams({ flashSale: false })} /> : null}
          {params.trending ? <FilterChip label="Trending" onRemove={() => setParams({ trending: false })} /> : null}
          {params.source !== 'all' ? (
            <FilterChip
              label={params.source === 'dropship' ? 'Dropship only' : 'Regular stock only'}
              onRemove={() => setParams({ source: 'all' })}
            />
          ) : null}
          <Pressable onPress={clearFilters} style={{ justifyContent: 'center' }}>
            <Text style={styles.clearAll}>Clear all</Text>
          </Pressable>
        </ScrollView>
      ) : null}
    </View>
  )

  let status = null
  if (isLoading) {
    status = <ProductGridSkeleton count={8} />
  } else if (error) {
    status = <ErrorState error={error} onRetry={refetch} />
  } else if (products.length === 0) {
    status = (
      <EmptyResult
        icon={'🔍'}
        title={params.search ? `No products match “${params.search}”` : 'No products found'}
        description={
          activeFilterCount > 0
            ? 'Try removing a filter or two — your current combination has no matches.'
            : 'Nothing is listed here yet. Check back soon.'
        }
        action={
          activeFilterCount > 0 ? (
            <Pressable onPress={clearFilters} style={styles.emptyBtn}>
              <Text style={styles.emptyBtnText}>Clear filters</Text>
            </Pressable>
          ) : (
            <Pressable onPress={() => router.push(USER_ROUTES.CATEGORIES)} style={styles.emptyBtn}>
              <Text style={styles.emptyBtnText}>Browse categories</Text>
            </Pressable>
          )
        }
      />
    )
  }

  const showGrid = !isLoading && !error && products.length > 0
  const data = showGrid ? (products.length % 2 ? [...products, SPACER] : products) : []

  return (
    <Screen nav scroll={false} header={topBar}>
      <FlatList
        ref={listRef}
        data={data}
        keyExtractor={keyExtractor}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        ItemSeparatorComponent={Separator}
        renderItem={renderItem}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews
        ListHeaderComponent={resultsHeader}
        ListHeaderComponentStyle={{ marginBottom: 16 }}
        ListEmptyComponent={status}
        ListFooterComponent={
          showGrid && pagination && pagination.totalPages > 1 ? (
            <Pagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              totalItems={pagination.total}
              rowsPerPage={pagination.limit}
              onPageChange={goToPage}
              itemLabel="products"
            />
          ) : null
        }
        // Dimmed rather than replaced while a new page loads, so the grid never blanks out.
        style={{ opacity: isFetching && !isLoading ? 0.6 : 1 }}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      />

      <FilterSheet open={isFilterSheetOpen} onClose={() => setFilterSheetOpen(false)}>
        <CatalogFilterPanel
          params={params}
          brands={brands}
          categories={categories}
          showCategories={mode === 'listing'}
          showSort
          onApply={(draft) => {
            scrollTop(false)
            setParams({
              category: draft.category,
              brands: draft.brands,
              minPrice: draft.minPrice,
              maxPrice: draft.maxPrice,
              rating: draft.rating,
              inStock: draft.inStock,
              minDiscount: draft.minDiscount,
              source: draft.source,
              flashSale: draft.flashSale,
              trending: draft.trending,
              sort: draft.sort,
            })
          }}
          onClear={() => {
            scrollTop(false)
            clearFilters()
          }}
          onClose={() => setFilterSheetOpen(false)}
        />
      </FilterSheet>

      <Sheet visible={isSortOpen} onClose={() => setSortOpen(false)}>
        <View style={styles.sortSheetHeader}>
          <Text style={styles.sortSheetTitle}>Sort</Text>
        </View>
        <View style={{ padding: 8 }}>
          {SORT_OPTIONS.map((option) => {
            const selected = option.value === params.sort
            return (
              <Pressable
                key={option.value}
                onPress={() => {
                  setParams({ sort: option.value })
                  setSortOpen(false)
                }}
                style={[styles.sortOption, selected && { backgroundColor: colors.blue[50] }]}
              >
                <Text style={[styles.sortOptionText, { color: selected ? colors.blue[700] : colors.slate[700] }]}>
                  {option.label}
                </Text>
                {selected ? <Icon name="HiCheck" size={16} color={colors.blue[700]} /> : null}
              </Pressable>
            )
          })}
        </View>
      </Sheet>
    </Screen>
  )
}

// Keeps a lone last card at half width, like the web grid.
const SPACER = { id: '__spacer' }

const keyExtractor = (item) => item.id

// Module-level so FlatList never sees a new renderItem identity. Only the first few cards fade/rise in
// (staggered), the rest of a long grid renders plain.
const CARD_FILL = { flex: 1 }
function renderItem({ item, index }) {
  if (item === SPACER) return <View style={CARD_FILL} />
  const card = <ProductCard product={item} layout="grid" priority={index < 4} style={CARD_FILL} />
  if (index >= 6) return card
  return (
    <Animated.View entering={enterFade(index)} style={CARD_FILL}>
      {card}
    </Animated.View>
  )
}

function Separator() {
  return <View style={{ height: 12 }} />
}

function FilterChip({ label, onRemove }) {
  return (
    <View style={styles.filterChip}>
      <Text noTranslate numberOfLines={1} style={styles.filterChipLabel}>
        {label}
      </Text>
      <Pressable
        onPress={onRemove}
        accessibilityRole="button"
        hitSlop={8}
        accessibilityLabel={`Remove filter ${label}`}
        style={({ pressed }) => [styles.filterChipX, pressed && { backgroundColor: colors.slate[100] }]}
      >
        <Icon name="HiXMark" size={14} color={colors.slate[400]} />
      </Pressable>
    </View>
  )
}

// Builds the page list with ellipses: always first and last, plus a window around the current page.
// Port of components/ui/Pagination.jsx at phone width (size="touch"): "Showing a-b of N products"
// and prev / "page / total" / next.
function Pagination({ page, totalPages, onPageChange, totalItems, rowsPerPage, itemLabel = 'results' }) {
  const canPrev = page > 1
  const canNext = page < totalPages
  const from = rowsPerPage ? (page - 1) * rowsPerPage + 1 : null
  const to = rowsPerPage && totalItems ? Math.min(page * rowsPerPage, totalItems) : null

  return (
    <View style={styles.pagination}>
      <View style={styles.pageInfo}>
        {totalItems === 0 ? (
          <>
            <Text noTranslate style={styles.pageBold}>
              0
            </Text>
            <Text style={styles.pageText}>{itemLabel}</Text>
          </>
        ) : totalItems !== undefined && from !== null ? (
          <>
            <Text style={styles.pageText}>Showing</Text>
            <Text noTranslate style={styles.pageBold}>{`${from}–${to}`}</Text>
            <Text style={styles.pageText}>of</Text>
            <Text noTranslate style={styles.pageBold}>
              {totalItems.toLocaleString('en-IN')}
            </Text>
            <Text style={styles.pageText}>{itemLabel}</Text>
          </>
        ) : (
          <>
            <Text style={styles.pageText}>Page</Text>
            <Text noTranslate style={styles.pageBold}>
              {page}
            </Text>
            <Text style={styles.pageText}>of</Text>
            <Text noTranslate style={styles.pageBold}>
              {totalPages}
            </Text>
          </>
        )}
      </View>

      <View style={styles.pageNav}>
        <Pressable
          disabled={!canPrev}
          onPress={() => onPageChange(page - 1)}
          accessibilityLabel="Previous page"
          style={[styles.pageBtn, shadows.xs, !canPrev && { opacity: 0.4 }]}
        >
          <Icon name="HiChevronLeft" size={16} color={colors.ink.muted} />
        </Pressable>
        <Text noTranslate style={[styles.pageText, { paddingHorizontal: 8 }]}>
          {`${page} / ${totalPages}`}
        </Text>
        <Pressable
          disabled={!canNext}
          onPress={() => onPageChange(page + 1)}
          accessibilityLabel="Next page"
          style={[styles.pageBtn, shadows.xs, !canNext && { opacity: 0.4 }]}
        >
          <Icon name="HiChevronRight" size={16} color={colors.ink.muted} />
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  topBarWrap: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.8)',
    backgroundColor: 'rgba(255,255,255,0.95)',
    padding: 12,
  },
  backBtn: { height: 36, width: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 9999 },
  searchBox: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.slate[200],
    backgroundColor: colors.slate[100],
    paddingHorizontal: 12,
    height: 40,
  },
  searchInput: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 0,
    fontSize: 12,
    fontFamily: fontFamilyFor('700'),
    color: colors.slate[900],
  },
  clearBtn: { height: 28, width: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 9999 },
  filterBtn: {
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.xl,
    backgroundColor: colors.blue[600],
    paddingHorizontal: 12,
  },
  filterText: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: '#fff' },
  filterCount: {
    height: 16,
    minWidth: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9999,
    backgroundColor: '#fff',
    paddingHorizontal: 4,
  },
  filterCountText: { fontSize: 10, lineHeight: 14, fontWeight: '800', color: colors.blue[700] },

  columnWrapper: { gap: 12 },
  listContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 },
  resultsCard: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.8)',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  heading: { fontSize: 14, lineHeight: 20, fontWeight: '800', color: colors.slate[900] },
  count: { fontSize: 11, lineHeight: 16, fontWeight: '600', color: colors.slate[500] },
  sortWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  sortLabel: { fontSize: 11, lineHeight: 16, fontWeight: '700', color: colors.slate[500] },
  sortSelect: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.slate[200],
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  sortValue: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: colors.slate[800] },
  activeChips: { alignItems: 'center', gap: 8, paddingHorizontal: 16 },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: colors.slate[200],
    backgroundColor: '#fff',
    paddingVertical: 4,
    paddingLeft: 12,
    paddingRight: 4,
  },
  filterChipLabel: { maxWidth: 160, fontSize: 11, lineHeight: 16, fontWeight: '700', color: colors.slate[700] },
  filterChipX: { height: 24, width: 24, alignItems: 'center', justifyContent: 'center', borderRadius: 9999 },
  clearAll: { fontSize: 11, lineHeight: 16, fontWeight: '700', color: colors.blue[600] },
  emptyBtn: { borderRadius: radius.xl, backgroundColor: colors.blue[600], paddingHorizontal: 20, paddingVertical: 10 },
  emptyBtnText: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: '#fff' },

  sortSheetHeader: { borderBottomWidth: 1, borderBottomColor: colors.slate[100], paddingHorizontal: 16, paddingVertical: 12 },
  sortSheetTitle: { fontSize: 14, lineHeight: 20, fontWeight: '800', color: colors.slate[900] },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.xl,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  sortOptionText: { fontSize: 14, lineHeight: 20, fontWeight: '600' },

  pagination: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    paddingTop: 24,
  },
  pageInfo: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 },
  pageText: { fontSize: 12, lineHeight: 16, color: colors.ink.subtle },
  pageBold: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.slate[900] },
  pageNav: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pageBtn: {
    height: 40,
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.DEFAULT,
    backgroundColor: colors.surface.DEFAULT,
  },
})
