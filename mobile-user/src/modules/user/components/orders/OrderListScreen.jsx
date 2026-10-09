import { useEffect, useState } from 'react'
import { View, Pressable, ScrollView, TextInput, FlatList, RefreshControl, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { Screen } from '../../../../components/layout/Screen'
import { Text } from '../../../../components/ui/Text'
import { Icon } from '../../../../components/ui/Icon'
import { SmartImage } from '../../../../components/ui/SmartImage'
import { EmptyResult, ErrorState, ListSkeleton } from '../../../../components/ui/AsyncBoundary'
import { Animated, PressableScale, enterFade, fadeIn } from '../../../../components/ui/motion'
import { USER_ROUTES, userPath } from '../../../../config/routes'
import { useCartStore } from '../../../../lib/cartStore'
import { colors, fonts, shadows } from '../../../../theme'
import { useOrdersController } from '../../controllers/useOrdersController'
import { reorderOrder } from '../../services/orderService'

const TABS = [
  { label: 'All', value: '' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Processing', value: 'PROCESSING' },
  { label: 'Shipped', value: 'SHIPPED' },
  { label: 'Delivered', value: 'DELIVERED' },
  { label: 'Cancelled', value: 'CANCELLED' },
]

const STATUS_META = {
  PENDING: { label: 'Pending', bg: colors.slate[100], fg: colors.slate[700], border: colors.slate[200] },
  PROCESSING: { label: 'Processing', bg: colors.amber[100], fg: colors.amber[800], border: colors.amber[200] },
  SHIPPED: { label: 'Shipped', bg: colors.blue[100], fg: colors.blue[800], border: colors.blue[200] },
  DELIVERED: { label: 'Delivered', bg: colors.emerald[100], fg: colors.emerald[800], border: colors.emerald[200] },
  CANCELLED: { label: 'Cancelled', bg: colors.red[100], fg: colors.red[800], border: colors.red[200] },
}

const SEARCH_DEBOUNCE_MS = 400

function formatOrderNumber(id) {
  return id.slice(-8).toUpperCase()
}

const keyExtractor = (order) => order.id
const ItemSeparator = () => <View style={{ height: 16 }} />

export function OrderListScreen() {
  const router = useRouter()
  // Tab and page are kept in component state: the screen stays mounted under the order-details
  // screen, so coming back lands on the same tab and page (what the web keeps in the URL).
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)

  const [searchDraft, setSearchDraft] = useState('')
  const [query, setQuery] = useState('')
  const [reorderingId, setReorderingId] = useState(null)
  const [reorderError, setReorderError] = useState(null)

  const handleReorderClick = async (orderId) => {
    // One reorder at a time: a second tap while the first is in flight must not add the items twice.
    if (reorderingId) return
    try {
      setReorderingId(orderId)
      setReorderError(null)
      const res = await reorderOrder(orderId)
      await useCartStore.getState().hydrate()
      if (res.data?.addedCount > 0) {
        router.push(USER_ROUTES.CART)
      } else {
        setReorderError(res.message || 'Items from this order are currently out of stock')
      }
    } catch (err) {
      setReorderError(err?.response?.data?.message || 'Could not reorder items')
    } finally {
      setReorderingId(null)
    }
  }

  useEffect(() => {
    if (searchDraft.trim() === query) return undefined
    const timer = setTimeout(() => {
      setQuery(searchDraft.trim())
      setPage(1)
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [searchDraft, query])

  const { orders, pagination, isLoading, isFetching, error, refetch } = useOrdersController({
    status: status || undefined,
    page,
  })

  const selectTab = (value) => {
    setStatus(value)
    setPage(1)
  }

  // Search is applied client-side over the current page only, and the UI says so. The orders
  // endpoint has no text search.
  const visibleOrders = query
    ? orders.filter(
        (order) =>
          formatOrderNumber(order.id).toLowerCase().includes(query.toLowerCase()) ||
          order.previewItems.some((item) => item.name.toLowerCase().includes(query.toLowerCase())),
      )
    : orders

  const header = (
    <View style={styles.headerWrap}>
      <View style={styles.titleCard}>
        <View>
          <Text style={styles.h1}>My Orders</Text>
          <Text style={styles.subtitle}>Track your shipments and request returns.</Text>
        </View>

        <View style={{ gap: 8 }}>
          <Pressable onPress={() => router.push(USER_ROUTES.RETURNS)} style={styles.returnsLink}>
            <Icon name="HiArrowPath" size={16} color={colors.slate[500]} />
            <Text style={styles.returnsLinkText}>Returns & Claims</Text>
          </Pressable>

          <View style={styles.searchBox}>
            <Icon name="HiMagnifyingGlass" size={16} color={colors.slate[400]} />
            <TextInput
              value={searchDraft}
              onChangeText={setSearchDraft}
              placeholder="Search this page…"
              placeholderTextColor={colors.slate[400]}
              returnKeyType="search"
              accessibilityLabel="Search orders on this page"
              style={styles.searchInput}
            />
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          accessibilityRole="tablist"
          contentContainerStyle={styles.tabsRow}
          style={styles.tabsScroll}
        >
          {TABS.map((tab) => {
            const active = status === tab.value
            return (
              <Pressable
                key={tab.label}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => selectTab(tab.value)}
                style={[styles.tab, active && styles.tabActive]}
              >
                <Text style={[styles.tabText, { color: active ? '#fff' : colors.slate[600] }]}>{tab.label}</Text>
              </Pressable>
            )
          })}
        </ScrollView>
      </View>

      {reorderError ? (
        <Animated.View entering={fadeIn} style={styles.reorderError}>
          <Text style={styles.reorderErrorText}>{reorderError}</Text>
          <Pressable onPress={() => setReorderError(null)} accessibilityRole="button" hitSlop={10}>
            <Text style={styles.dismissText}>Dismiss</Text>
          </Pressable>
        </Animated.View>
      ) : null}
    </View>
  )

  const renderOrder = ({ item: order, index }) => {
    const meta = STATUS_META[order.status] || STATUS_META.PENDING
    const extraItems = order.itemCount - order.previewItems.length

    return (
      <Animated.View entering={enterFade(index)}>
      <PressableScale
        scaleTo={0.985}
        accessibilityRole="button"
        accessibilityLabel={`Order ${formatOrderNumber(order.id)}, ${meta.label}, total ${order.total} rupees`}
        onPress={() => router.push(userPath.order(order.id))}
        style={styles.orderCard}
      >
        <View style={styles.orderTop}>
          <View style={{ flexShrink: 1, gap: 2 }}>
            <Text noTranslate numberOfLines={1} style={styles.orderNo}>
              {`Order #${formatOrderNumber(order.id)}`}
            </Text>
            <Text noTranslate numberOfLines={1} style={styles.orderDate}>
              {`Placed on ${new Date(order.createdAt).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}`}
            </Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: meta.bg, borderColor: meta.border }]}>
            <Text style={[styles.statusText, { color: meta.fg }]}>{meta.label}</Text>
          </View>
        </View>

        <View style={styles.previewRow}>
          <View style={styles.thumbs}>
            {order.previewItems.map((item, i) => (
              <SmartImage
                key={i}
                src={item.image}
                alt={item.name}
                ratio="1 / 1"
                style={[styles.thumb, i > 0 && { marginLeft: -8 }]}
              />
            ))}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text noTranslate numberOfLines={1} style={styles.previewNames}>
              {order.previewItems.map((item) => item.name).join(', ')}
              {extraItems > 0 ? ` +${extraItems} more` : ''}
            </Text>
            <Text style={styles.itemCount}>{`${order.itemCount} ${order.itemCount === 1 ? 'item' : 'items'}`}</Text>
          </View>
        </View>

        <View style={styles.orderBottom}>
          <View>
            <Text style={styles.totalLabel}>TOTAL AMOUNT</Text>
            <Text noTranslate style={styles.totalValue}>
              {`₹${order.total.toLocaleString('en-IN')}`}
            </Text>
          </View>
          <View style={styles.actionsRow}>
            {order.canReturn ? (
              <Pressable
                onPress={() => router.push(`${USER_ROUTES.RETURNS}?orderId=${order.id}`)}
                style={[styles.actionBtn, { backgroundColor: colors.amber[50], borderColor: colors.amber[200] }]}
              >
                <Icon name="HiArrowPath" size={14} color={colors.amber[800]} />
                <Text style={[styles.actionText, { color: colors.amber[800] }]}>Return / Replace</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => handleReorderClick(order.id)}
              disabled={reorderingId !== null}
              accessibilityRole="button"
              accessibilityState={{ busy: reorderingId === order.id }}
              style={[styles.actionBtn, reorderingId !== null && reorderingId !== order.id && { opacity: 0.5 }, { backgroundColor: colors.emerald[50], borderColor: colors.emerald[200] }]}
            >
              <Icon name="HiShoppingCart" size={14} color={colors.emerald[800]} />
              <Text style={[styles.actionText, { color: colors.emerald[800] }]}>
                {reorderingId === order.id ? 'Adding…' : 'Reorder'}
              </Text>
            </Pressable>
            <View style={styles.detailsLink}>
              <Text style={styles.detailsText}>Details</Text>
              <Icon name="HiChevronRight" size={16} color={colors.blue[600]} />
            </View>
          </View>
        </View>
      </PressableScale>
      </Animated.View>
    )
  }

  let empty = null
  if (isLoading) {
    empty = <ListSkeleton count={4} />
  } else if (error) {
    empty = <ErrorState error={error} onRetry={refetch} />
  } else if (orders.length === 0) {
    empty = (
      <EmptyResult
        icon="📦"
        title={status ? `No ${STATUS_META[status]?.label.toLowerCase()} orders` : 'No orders yet'}
        description={
          status
            ? 'Try a different tab to see your other orders.'
            : 'Once you place an order it will appear here with its status and tracking.'
        }
        action={
          !status ? (
            <Pressable onPress={() => router.push(USER_ROUTES.LISTING)} style={styles.emptyBtn}>
              <Text style={styles.emptyBtnText}>Start shopping</Text>
            </Pressable>
          ) : null
        }
      />
    )
  } else if (visibleOrders.length === 0) {
    empty = (
      <EmptyResult
        icon="🔍"
        title={`No orders on this page match “${query}”`}
        description="Order search only covers the page you are on. Try another page, or clear the search."
        action={
          <Pressable
            onPress={() => {
              setSearchDraft('')
              setQuery('')
            }}
            style={styles.emptyBtn}
          >
            <Text style={styles.emptyBtnText}>Clear search</Text>
          </Pressable>
        }
      />
    )
  }

  const footer =
    !empty && pagination && pagination.totalPages > 1 ? (
      <View style={styles.pager}>
        <Text style={styles.pagerInfo}>
          {`Showing ${(pagination.page - 1) * pagination.limit + 1}–${Math.min(
            pagination.page * pagination.limit,
            pagination.total,
          )} of ${pagination.total.toLocaleString('en-IN')} orders`}
        </Text>
        <View style={styles.pagerBtns}>
          <Pressable
            disabled={pagination.page <= 1}
            onPress={() => setPage(pagination.page - 1)}
            accessibilityLabel="Previous page"
            style={[styles.pagerBtn, { opacity: pagination.page <= 1 ? 0.4 : 1 }]}
          >
            <Icon name="HiChevronLeft" size={16} color={colors.ink.muted} />
          </Pressable>
          <Text noTranslate style={styles.pagerPage}>{`${pagination.page} / ${pagination.totalPages}`}</Text>
          <Pressable
            disabled={pagination.page >= pagination.totalPages}
            onPress={() => setPage(pagination.page + 1)}
            accessibilityLabel="Next page"
            style={[styles.pagerBtn, { opacity: pagination.page >= pagination.totalPages ? 0.4 : 1 }]}
          >
            <Icon name="HiChevronRight" size={16} color={colors.ink.muted} />
          </Pressable>
        </View>
      </View>
    ) : null

  return (
    <Screen tab scroll={false}>
      <FlatList
        data={empty ? [] : visibleOrders}
        keyExtractor={keyExtractor}
        renderItem={renderOrder}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={7}
        removeClippedSubviews
        ListFooterComponent={footer}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={ItemSeparator}
        style={{ opacity: isFetching && !isLoading ? 0.6 : 1 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  listContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16 },
  headerWrap: { gap: 16, marginBottom: 16 },
  titleCard: {
    gap: 16,
    backgroundColor: '#fff',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.8)',
    padding: 20,
    ...shadows.sm,
  },
  h1: { fontSize: 20, lineHeight: 28, fontWeight: '800', color: colors.slate[900] },
  subtitle: { marginTop: 4, fontSize: 12, lineHeight: 16, color: colors.slate[500] },
  returnsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.slate[200],
    backgroundColor: colors.slate[50],
    paddingHorizontal: 14,
    paddingVertical: 10,
    ...shadows.xs,
  },
  returnsLinkText: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: colors.slate[700] },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.slate[200],
    backgroundColor: colors.slate[100],
    paddingHorizontal: 14,
  },
  searchInput: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 10,
    fontSize: 12,
    fontFamily: fonts[600],
    color: colors.slate[900],
  },
  tabsScroll: { borderTopWidth: 1, borderTopColor: colors.slate[100], flexGrow: 0 },
  tabsRow: { alignItems: 'center', gap: 8, paddingTop: 12 },
  tab: { borderRadius: 16, paddingHorizontal: 16, paddingVertical: 10 },
  tabActive: { backgroundColor: colors.slate[900], ...shadows.sm },
  tabText: { fontSize: 12, lineHeight: 16, fontWeight: '700' },
  reorderError: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.amber[50],
    borderWidth: 1,
    borderColor: colors.amber[200],
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    ...shadows.xs,
  },
  reorderErrorText: { flex: 1, fontSize: 12, lineHeight: 16, color: colors.amber[800] },
  dismissText: { marginLeft: 12, fontSize: 12, lineHeight: 16, fontWeight: '700', color: colors.amber[900] },
  orderCard: {
    gap: 16,
    overflow: 'hidden',
    backgroundColor: '#fff',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.8)',
    padding: 16,
    ...shadows.sm,
  },
  orderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
    paddingBottom: 12,
  },
  orderNo: { fontSize: 12, lineHeight: 16, fontWeight: '800', color: colors.slate[900] },
  orderDate: { fontSize: 11, lineHeight: 16, fontWeight: '600', color: colors.slate[500] },
  statusPill: { borderRadius: 9999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 10, lineHeight: 15, fontWeight: '700' },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  thumbs: { flexDirection: 'row' },
  thumb: {
    width: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.slate[200],
    backgroundColor: '#fff',
  },
  previewNames: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: colors.slate[900] },
  itemCount: { fontSize: 11, lineHeight: 16, fontWeight: '500', color: colors.slate[500] },
  orderBottom: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.slate[100],
    paddingTop: 12,
  },
  totalLabel: { fontSize: 10, lineHeight: 15, fontWeight: '700', color: colors.slate[400], letterSpacing: 1 },
  totalValue: { fontSize: 14, lineHeight: 20, fontWeight: '800', color: colors.blue[700] },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  actionText: { fontSize: 12, lineHeight: 16, fontWeight: '700' },
  detailsLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  detailsText: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: colors.blue[600] },
  emptyBtn: { borderRadius: 12, backgroundColor: colors.blue[600], paddingHorizontal: 20, paddingVertical: 10 },
  emptyBtnText: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: '#fff' },
  pager: { marginTop: 16, gap: 12, alignItems: 'center' },
  pagerInfo: { fontSize: 12, lineHeight: 16, color: colors.ink.subtle },
  pagerBtns: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pagerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border.DEFAULT,
    backgroundColor: colors.surface.DEFAULT,
    ...shadows.xs,
  },
  pagerPage: { paddingHorizontal: 8, fontSize: 12, lineHeight: 16, color: colors.ink.subtle },
})
