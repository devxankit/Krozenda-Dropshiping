import { StyleSheet, View } from 'react-native'
import { Button, Text } from '../../ui'
import { colors } from '../../../theme'

// actions: [{ label, icon?, tone?: 'default' | 'danger', onClick }]
export function BulkActionBar({ count, label = 'selected', actions = [], onClear }) {
  return (
    <View style={styles.bar}>
      <Text noTranslate style={styles.count}>
        {`${count} ${label}`}
      </Text>

      <View style={styles.actions}>
        {actions.map((action) => (
          <Button
            key={action.label}
            variant={action.tone === 'danger' ? 'dangerOutline' : 'secondary'}
            size="sm"
            icon={action.icon}
            onPress={() => action.onClick?.()}
          >
            {action.label}
          </Button>
        ))}
      </View>

      <View style={{ flex: 1 }} />
      <Button variant="ghost" size="sm" onPress={onClear}>
        Clear selection
      </Button>
    </View>
  )
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, borderBottomWidth: 1,
    borderBottomColor: colors.brand[100], backgroundColor: colors.brand[50], paddingHorizontal: 16, paddingVertical: 10,
  },
  count: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.brand[700], fontVariant: ['tabular-nums'] },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
})
