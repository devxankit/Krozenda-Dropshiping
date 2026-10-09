import { Pressable, ScrollView, View, StyleSheet } from 'react-native'
import { colors, radius, shadows } from '../../theme'
import { Text } from './Text'

// items: [{ id, label, count? }]. Controlled; reports the change via onChange(id).
// Phone layout of the web Tabs: a horizontally scrollable strip of pills with a bottom rule.
export function Tabs({ items = [], activeId, onChange, style }) {
  return (
    <View style={[styles.rule, style]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.strip}>
        {items.map((item) => {
          const isActive = item.id === activeId
          return (
            <Pressable
              key={item.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              onPress={() => onChange?.(item.id)}
              style={[styles.tab, isActive ? [styles.tabOn, shadows.xs] : styles.tabOff]}
            >
              <Text style={{ fontSize: 12, fontWeight: isActive ? '700' : '500', color: isActive ? colors.brand[700] : colors.slate[500] }}>
                {item.label}
              </Text>
              {item.count !== undefined ? (
                <View style={[styles.count, { backgroundColor: isActive ? colors.brand[100] : colors.slate[100] }]}>
                  <Text noTranslate style={{ fontSize: 10, lineHeight: 14, fontWeight: '700', color: isActive ? colors.brand[800] : colors.slate[500] }}>
                    {item.count}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          )
        })}
      </ScrollView>
    </View>
  )
}

// The pill variant, for switching a view mode rather than a data set.
export function SegmentedControl({ items = [], activeId, onChange, style }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      style={[{ flexGrow: 0, alignSelf: 'flex-start', maxWidth: '100%' }, styles.seg, style]}
      contentContainerStyle={{ gap: 4, padding: 4 }}
    >
      {items.map((item) => {
        const isActive = item.id === activeId
        return (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            onPress={() => onChange?.(item.id)}
            style={[styles.segItem, isActive && [{ backgroundColor: colors.surface.DEFAULT }, shadows.raised]]}
          >
            <Text style={{ fontSize: 12, fontWeight: isActive ? '600' : '500', color: isActive ? colors.slate[900] : colors.ink.subtle }}>
              {item.label}
            </Text>
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  rule: { borderBottomWidth: 1, borderBottomColor: colors.border.DEFAULT, paddingBottom: 4 },
  strip: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tab: { height: 30, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, borderRadius: radius.lg, borderWidth: 1 },
  tabOn: { backgroundColor: colors.brand[50], borderColor: 'rgba(191,219,254,0.8)' },
  tabOff: { borderColor: 'transparent' },
  count: { borderRadius: 9999, paddingHorizontal: 6, paddingVertical: 1 },
  seg: { backgroundColor: colors.surface.sunken, borderRadius: radius.md },
  segItem: { height: 28, paddingHorizontal: 12, borderRadius: radius.DEFAULT, alignItems: 'center', justifyContent: 'center' },
})
