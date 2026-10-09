import { Pressable, StyleSheet, View } from 'react-native'
import { Icon, Text } from '../../ui'
import { colors, radius, shadows } from '../../../theme'

// Layout primitives shared by every detail screen.

export function SectionCard({ title, description, actions, footer, children, style }) {
  return (
    <View style={[styles.card, style]}>
      {title || actions ? (
        <View style={styles.cardHeader}>
          <View style={{ minWidth: 0, flexShrink: 1 }}>
            {title ? <Text style={styles.cardTitle}>{title}</Text> : null}
            {description ? <Text style={styles.cardDesc}>{description}</Text> : null}
          </View>
          {actions ? <View style={styles.cardActions}>{actions}</View> : null}
        </View>
      ) : null}
      {children}
      {footer ? <View style={styles.cardFooter}>{footer}</View> : null}
    </View>
  )
}

// items: [{ label, value }]
export function KeyValueList({ items = [], columns = 1, style }) {
  const rows = []
  for (let i = 0; i < items.length; i += columns) rows.push(items.slice(i, i + columns))
  return (
    <View style={style}>
      {rows.map((row, rowIndex) => (
        <View
          key={`r${rowIndex}`}
          style={[{ flexDirection: 'row', gap: 24 }, rowIndex > 0 && styles.kvDivider]}
        >
          {row.map((item) => (
            <View key={item.label} style={styles.kvItem}>
              <Text style={styles.kvLabel}>{item.label}</Text>
              {typeof item.value === 'string' || typeof item.value === 'number' ? (
                <Text numberOfLines={1} style={styles.kvValue}>
                  {item.value}
                </Text>
              ) : (
                <View style={{ minWidth: 0, flexShrink: 1, alignItems: 'flex-end' }}>{item.value}</View>
              )}
            </View>
          ))}
        </View>
      ))}
    </View>
  )
}

// events: [{ label, at, actor, reason, tone, done }]
export function Timeline({ events = [] }) {
  const TONE = { success: colors.success[500], danger: colors.danger[500], warning: colors.warning[500] }

  return (
    <View>
      {events.map((event, index) => {
        const isLast = index === events.length - 1
        return (
          <View key={`${event.label}-${index}`} style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ alignItems: 'center' }}>
              <View
                style={[
                  styles.dot,
                  { backgroundColor: event.done ? TONE[event.tone] || colors.brand[600] : colors.border.strong },
                ]}
              />
              {!isLast ? <View style={{ width: 1, flex: 1, backgroundColor: colors.border.DEFAULT }} /> : null}
            </View>
            <View style={{ flex: 1, minWidth: 0, paddingBottom: isLast ? 0 : 16 }}>
              <Text style={{ fontSize: 12, lineHeight: 16, fontWeight: '600', color: event.done ? colors.slate[900] : colors.ink.faint }}>
                {event.label}
              </Text>
              {event.at ? (
                <Text noTranslate style={styles.tlAt}>
                  {event.at}
                  {event.actor ? ` · ${event.actor}` : ''}
                </Text>
              ) : null}
              {event.reason ? <Text style={styles.tlReason}>{event.reason}</Text> : null}
            </View>
          </View>
        )
      })}
    </View>
  )
}

// Inline icon-button row (the structure variant; the dropdown variant lives in data/RowActions).
export function RowActions({ items = [] }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
      {items.map((item) => (
        <Pressable
          key={item.label}
          onPress={item.onClick || item.onPress}
          accessibilityLabel={item.label}
          style={{ borderRadius: radius.md, padding: 6 }}
        >
          <Icon name={item.icon} size={14} color={colors.ink.faint} />
        </Pressable>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    minWidth: 0, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.slate[200] + 'cc',
    backgroundColor: '#fff', ...shadows.xs,
  },
  cardHeader: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between',
    columnGap: 12, rowGap: 6, borderBottomWidth: 1, borderBottomColor: colors.border.DEFAULT,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  cardTitle: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: colors.slate[900] },
  cardDesc: { marginTop: 2, fontSize: 11, lineHeight: 15, color: colors.ink.subtle },
  cardActions: { flexShrink: 0, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  cardFooter: { borderTopWidth: 1, borderTopColor: colors.border.DEFAULT, paddingHorizontal: 12, paddingVertical: 8 },
  kvDivider: { borderTopWidth: 1, borderTopColor: colors.border.subtle },
  kvItem: { flex: 1, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, paddingVertical: 8 },
  kvLabel: { flexShrink: 0, fontSize: 12, lineHeight: 16, color: colors.ink.subtle },
  kvValue: { flexShrink: 1, minWidth: 0, textAlign: 'right', fontSize: 12, lineHeight: 16, fontWeight: '500', color: colors.slate[900] },
  dot: { marginTop: 4, height: 10, width: 10, borderRadius: 5, borderWidth: 0 },
  tlAt: { marginTop: 2, fontSize: 11, lineHeight: 16, color: colors.ink.faint, fontVariant: ['tabular-nums'] },
  tlReason: { marginTop: 4, fontSize: 11, lineHeight: 15, color: colors.ink.subtle },
})
