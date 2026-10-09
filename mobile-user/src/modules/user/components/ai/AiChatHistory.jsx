import { useMemo } from 'react'
import { FlatList, Pressable, StyleSheet, View } from 'react-native'
import { Icon } from '../../../../components/ui/Icon'
import { Skeleton } from '../../../../components/ui/Skeleton'
import { Text } from '../../../../components/ui/Text'
import { colors } from '../../../../theme'

// Groups threads the way a customer thinks about them, not by raw timestamp.
function groupByDay(conversations) {
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const startOfYesterday = new Date(startOfToday.getTime() - 86400000)
  const startOfWeek = new Date(startOfToday.getTime() - 7 * 86400000)

  const groups = { Today: [], Yesterday: [], 'Previous 7 days': [], Earlier: [] }

  for (const conversation of conversations) {
    const at = new Date(conversation.lastMessageAt)
    if (at >= startOfToday) groups.Today.push(conversation)
    else if (at >= startOfYesterday) groups.Yesterday.push(conversation)
    else if (at >= startOfWeek) groups['Previous 7 days'].push(conversation)
    else groups.Earlier.push(conversation)
  }

  return Object.entries(groups).filter(([, items]) => items.length > 0)
}

function formatStamp(value) {
  try {
    return new Date(value).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  } catch {
    return String(value)
  }
}

export function AiChatHistory({
  conversations = [],
  isLoading = false,
  activeConversationId = null,
  onSelect = () => {},
  onDelete = () => {},
  onNewChat = () => {},
  onClose = () => {},
}) {
  // Flatten the groups into one list (label rows + conversation rows) so FlatList can virtualise it.
  const rows = useMemo(() => {
    const out = []
    for (const [label, items] of groupByDay(conversations)) {
      out.push({ key: `label-${label}`, type: 'label', label })
      items.forEach((conversation, i) =>
        out.push({ key: conversation.id, type: 'item', conversation, last: i === items.length - 1 }),
      )
    }
    return out
  }, [conversations])

  const renderRow = ({ item }) => {
    if (item.type === 'label') return <Text style={styles.groupLabel}>{item.label.toUpperCase()}</Text>
    const { conversation } = item
    const isActive = conversation.id === activeConversationId
    return (
      <View style={[styles.item, isActive ? styles.itemActive : styles.itemIdle, { marginBottom: item.last ? 16 : 4 }]}>
        <Pressable onPress={() => onSelect(conversation.id)} style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={[styles.itemTitle, { color: isActive ? colors.blue[800] : colors.slate[800] }]}>
            {conversation.title}
          </Text>
          <Text noTranslate style={styles.itemDate}>{formatStamp(conversation.lastMessageAt)}</Text>
        </Pressable>
        <Pressable
          onPress={() => onDelete(conversation.id)}
          accessibilityLabel={`Delete conversation ${conversation.title}`}
          style={styles.deleteBtn}
        >
          <Icon name="HiOutlineTrash" size={16} color={colors.slate[400]} />
        </Pressable>
      </View>
    )
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Chat history</Text>
        <Pressable onPress={onClose} accessibilityLabel="Close chat history" style={styles.closeBtn}>
          <Icon name="HiXMark" size={20} color={colors.slate[500]} />
        </Pressable>
      </View>

      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        <Pressable onPress={onNewChat} style={({ pressed }) => [styles.newChat, pressed && { backgroundColor: colors.blue[100] }]}>
          <Icon name="HiOutlinePlus" size={16} color={colors.blue[700]} />
          <Text style={styles.newChatText}>New Chat</Text>
        </Pressable>
      </View>

      <FlatList
        data={isLoading ? [] : rows}
        keyExtractor={(row) => row.key}
        renderItem={renderRow}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          isLoading ? (
            <View style={{ gap: 8 }}>
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} style={{ height: 48, borderRadius: 16 }} />
              ))}
            </View>
          ) : null
        }
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Icon name="HiOutlineChatBubbleLeftRight" size={24} color={colors.slate[400]} />
              </View>
              <Text style={styles.emptyTitle}>No conversations yet</Text>
              <Text style={styles.emptySub}>Your past chats will show up here.</Text>
            </View>
          ) : null
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, zIndex: 20, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[200],
  },
  title: { fontSize: 14, lineHeight: 20, fontWeight: '800', color: colors.slate[900] },
  closeBtn: { padding: 6, borderRadius: 999 },
  newChat: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.blue[200],
    backgroundColor: colors.blue[50],
  },
  newChatText: { fontSize: 14, lineHeight: 20, fontWeight: '700', color: colors.blue[700] },
  groupLabel: { fontSize: 10, lineHeight: 15, fontWeight: '800', letterSpacing: 1, color: colors.slate[400], marginBottom: 6, paddingHorizontal: 4 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 16, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
  itemActive: { borderColor: colors.blue[200], backgroundColor: colors.blue[50] },
  itemIdle: { borderColor: 'transparent' },
  itemTitle: { fontSize: 14, lineHeight: 20, fontWeight: '700' },
  itemDate: { fontSize: 11, lineHeight: 16, fontWeight: '500', color: colors.slate[400] },
  deleteBtn: { padding: 6, borderRadius: 999 },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
  emptyIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.slate[100], alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  emptyTitle: { fontSize: 14, lineHeight: 20, fontWeight: '700', color: colors.slate[700] },
  emptySub: { fontSize: 12, lineHeight: 16, color: colors.slate[500], marginTop: 4 },
})
