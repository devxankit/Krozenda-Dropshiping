import { useEffect, useState } from 'react'
import { FlatList, Pressable, RefreshControl, ScrollView, View, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { Screen } from '../../../../components/layout/Screen'
import { Text } from '../../../../components/ui/Text'
import { Icon } from '../../../../components/ui/Icon'
import { Animated, enterFade, smoothLayout } from '../../../../components/ui/motion'
import { EmptyResult, ListSkeleton } from '../../../../components/ui/AsyncBoundary'
import { USER_ROUTES, userPath } from '../../../../config/routes'
import { useNotificationStore } from '../../../../lib/notificationStore'
import { colors, radius, shadows } from '../../../../theme'

const TYPE_ICON = {
  ORDER: { icon: 'HiTruck', bg: colors.emerald[50], fg: colors.emerald[600], border: colors.emerald[200] },
  OFFER: { icon: 'HiTag', bg: colors.amber[50], fg: colors.amber[600], border: colors.amber[200] },
  WALLET: { icon: 'HiWallet', bg: colors.indigo[50], fg: colors.indigo[600], border: colors.indigo[200] },
  SYSTEM: { icon: 'HiSparkles', bg: colors.blue[50], fg: colors.blue[600], border: colors.blue[200] },
}

const keyExtractor = (item) => String(item.id)
const ItemSeparator = () => <View style={{ height: 12 }} />

const ACTION_LABEL = { ORDER: 'View order', WALLET: 'Check wallet' }

const TABS = ['All', 'Orders', 'Promotions', 'Wallet']

function formatTime(iso) {
  const date = new Date(iso)
  const diffMs = Date.now() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins} min${diffMins === 1 ? '' : 's'} ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

export function NotificationCenterScreen() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('All')
  const [refreshing, setRefreshing] = useState(false)
  const notifications = useNotificationStore((state) => state.notifications)
  const unreadCount = useNotificationStore((state) => state.unreadCount)
  const pagination = useNotificationStore((state) => state.pagination)
  const isLoading = useNotificationStore((state) => state.isLoading)
  const hydrate = useNotificationStore((state) => state.hydrate)
  const markAsRead = useNotificationStore((state) => state.markAsRead)
  const markAllRead = useNotificationStore((state) => state.markAllRead)
  const deleteNotification = useNotificationStore((state) => state.remove)

  useEffect(() => {
    hydrate({ page: 1 })
  }, [hydrate])

  const filteredNotifications = notifications.filter((item) => {
    if (activeTab === 'Orders') return item.type === 'ORDER'
    if (activeTab === 'Promotions') return item.type === 'OFFER'
    if (activeTab === 'Wallet') return item.type === 'WALLET'
    return true
  })

  // Tapping a notification takes the buyer to the thing it is ABOUT, using the id the notification
  // carries. The id is never trusted: it is a path parameter on a route whose data the API scopes
  // to the authenticated buyer.
  const handleAction = (item) => {
    markAsRead(item.id)
    if (item.actionType === 'ORDER') {
      router.push(item.actionRefId ? userPath.order(item.actionRefId) : USER_ROUTES.ORDERS)
    } else if (item.actionType === 'WALLET') {
      router.push(USER_ROUTES.PROFILE)
    }
  }

  const goBack = () => {
    if (router.canGoBack()) router.back()
    else router.replace(USER_ROUTES.DASHBOARD)
  }

  const onRefresh = async () => {
    setRefreshing(true)
    await hydrate({ page: 1 })
    setRefreshing(false)
  }

  const renderItem = ({ item, index }) => {
    const meta = TYPE_ICON[item.type] || TYPE_ICON.SYSTEM
    const actionLabel = ACTION_LABEL[item.actionType]
    return (
      <Animated.View
        entering={enterFade(index)}
        layout={smoothLayout}
        style={[
          styles.card,
          shadows.xs,
          !item.isRead && { borderColor: colors.blue[300], backgroundColor: 'rgba(239,246,255,0.2)' },
        ]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, flex: 1, minWidth: 0 }}>
          <View style={[styles.typeIcon, { backgroundColor: meta.bg, borderColor: meta.border }]}>
            <Icon name={meta.icon} size={16} color={meta.fg} />
          </View>

          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
              <Text style={{ flex: 1, fontSize: 12, fontWeight: '700', color: colors.slate[900] }}>{item.title}</Text>
              <Text noTranslate style={{ fontSize: 10, fontWeight: '500', color: colors.slate[400] }}>
                {formatTime(item.createdAt)}
              </Text>
            </View>
            <Text style={{ fontSize: 12, lineHeight: 18, color: colors.slate[600] }}>{item.message}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 4 }}>
              {actionLabel ? (
                <Pressable onPress={() => handleAction(item)} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.blue[600] }}>{actionLabel}</Text>
                  <Icon name="HiChevronRight" size={12} color={colors.blue[600]} />
                </Pressable>
              ) : null}
              {!item.isRead ? (
                <Pressable onPress={() => markAsRead(item.id)}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.slate[500] }}>Mark as read</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>

        <Pressable
          onPress={() => deleteNotification(item.id)}
          accessibilityLabel={`Delete notification: ${item.title}`}
          style={({ pressed }) => [styles.deleteBtn, pressed && { backgroundColor: colors.red[50] }]}
        >
          <Icon name="HiTrash" size={14} color={colors.slate[400]} />
        </Pressable>
      </Animated.View>
    )
  }

  const listHeader = (
    <View style={{ gap: 20, marginBottom: 12 }}>
      {/* Header */}
      <View style={[styles.headCard, shadows.xs]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
          <Pressable onPress={goBack} accessibilityLabel="Go back" style={styles.backBtn}>
            <Icon name="HiArrowLeft" size={20} color={colors.slate[700]} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.slate[900] }}>Notifications</Text>
              {unreadCount > 0 ? (
                <View style={styles.newPill}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: colors.blue[700] }}>
                    <Text noTranslate style={{ fontSize: 10, fontWeight: '700', color: colors.blue[700] }}>
                      {unreadCount}
                    </Text>
                    {' New'}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text style={{ fontSize: 12, color: colors.slate[500] }}>Order updates, shipping alerts and offers</Text>
          </View>
        </View>

        {unreadCount > 0 ? (
          <Pressable onPress={markAllRead} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 8 }}>
            <Icon name="HiCheckCircle" size={16} color={colors.blue[600]} />
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.blue[600] }}>Mark all read</Text>
          </Pressable>
        ) : null}
      </View>

      {/* Filter tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ borderBottomWidth: 1, borderBottomColor: colors.slate[200] }}
        contentContainerStyle={{ gap: 8, paddingBottom: 8 }}
      >
        {TABS.map((tab) => {
          const active = activeTab === tab
          return (
            <Pressable
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={[styles.tab, active && [{ backgroundColor: colors.slate[900] }, shadows.xs]]}
            >
              <Text style={{ fontSize: 12, fontWeight: '700', color: active ? '#fff' : colors.slate[600] }}>{tab}</Text>
            </Pressable>
          )
        })}
      </ScrollView>
    </View>
  )

  const empty =
    isLoading && notifications.length === 0 ? (
      <ListSkeleton count={4} />
    ) : (
      <EmptyResult
        icon={'🔔'}
        title={activeTab === 'All' ? 'No notifications yet' : `No ${activeTab.toLowerCase()} notifications`}
        description={
          activeTab === 'All'
            ? 'Order updates, shipping alerts and offers will appear here.'
            : 'Try a different tab to see your other notifications.'
        }
      />
    )

  const listFooter = pagination?.hasNextPage ? (
    <Pressable
      onPress={() => hydrate({ page: pagination.page + 1 })}
      disabled={isLoading}
      style={[styles.more, isLoading && { opacity: 0.5 }]}
    >
      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.slate[700] }}>{isLoading ? 'Loading…' : 'Load older notifications'}</Text>
    </Pressable>
  ) : null

  return (
    <Screen nav scroll={false}>
      <FlatList
        data={filteredNotifications}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={empty}
        ListFooterComponent={listFooter}
        ItemSeparatorComponent={ItemSeparator}
        initialNumToRender={8}
        windowSize={7}
        contentContainerStyle={{ padding: 16 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  headCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.8)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: { height: 36, width: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 9999 },
  newPill: { paddingHorizontal: 8, paddingVertical: 2, backgroundColor: colors.blue[100], borderRadius: 9999 },
  tab: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.xl },
  card: {
    backgroundColor: '#fff',
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.8)',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  typeIcon: { width: 36, height: 36, borderRadius: radius.xl, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  deleteBtn: { marginTop: 2, height: 36, width: 36, alignItems: 'center', justifyContent: 'center', borderRadius: radius.lg },
  more: {
    marginTop: 20,
    width: '100%',
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.slate[200],
    backgroundColor: '#fff',
    paddingVertical: 14,
    alignItems: 'center',
  },
})
