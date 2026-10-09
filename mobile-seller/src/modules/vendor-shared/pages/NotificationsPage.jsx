import { Pressable, StyleSheet, View } from 'react-native'
import { Badge, Button, Text } from '../../../components/ui'
import { PageBody, PageHeader } from '../../../components/admin/shell'
import { colors, sp } from '../../../theme'
import { useVendorNotificationsController } from '../controllers/useVendorController'

export function NotificationsPage() {
  const { items, unreadCount, isLoading, markRead, markAllRead } = useVendorNotificationsController()

  return (
    <PageBody>
      <PageHeader
        title="Notifications"
        description="Orders, returns, approvals and platform announcements."
        actions={
          unreadCount > 0 ? (
            <Button size="sm" variant="secondary" onPress={() => markAllRead()}>
              Mark all read
            </Button>
          ) : null
        }
      />

      {isLoading ? <Text style={styles.muted}>Loading notifications…</Text> : null}
      {!isLoading && items.length === 0 ? <Text style={styles.muted}>No notifications yet.</Text> : null}

      <View style={{ gap: sp(2) }}>
        {items.map((n) => (
          <Pressable
            key={n.id}
            onPress={() => !n.isRead && markRead(n.id)}
            style={[styles.row, n.isRead ? styles.rowRead : styles.rowUnread]}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={styles.titleLine}>
                <Text style={styles.title}>{n.title}</Text>
                {!n.isRead ? (
                  <Badge tone="brand" size="xs" style={{ paddingHorizontal: 0, paddingVertical: 0 }} textStyle={{ fontSize: 12 }}>
                    New
                  </Badge>
                ) : null}
              </View>
              <Text style={styles.message}>{n.message}</Text>
            </View>
            <Text noTranslate style={styles.date}>
              {new Date(n.createdAt).toLocaleDateString('en-IN')}
            </Text>
          </Pressable>
        ))}
      </View>
    </PageBody>
  )
}

const styles = StyleSheet.create({
  muted: { fontSize: 12, lineHeight: 16, color: colors.ink.subtle },
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: sp(3), borderRadius: 12, borderWidth: 1, padding: 14 },
  rowRead: { borderColor: colors.border.DEFAULT, backgroundColor: colors.surface.DEFAULT },
  rowUnread: { borderColor: colors.brand[200], backgroundColor: colors.brand[50] + '66' },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: sp(2), flexWrap: 'wrap' },
  title: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.slate[900] },
  message: { marginTop: 2, fontSize: 12, lineHeight: 16, color: colors.ink.subtle },
  date: { flexShrink: 0, fontSize: 11, lineHeight: 16, color: colors.ink.faint },
})
