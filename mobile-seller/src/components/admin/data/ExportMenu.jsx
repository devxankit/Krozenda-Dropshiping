import { Pressable, StyleSheet, View } from 'react-native'
import { Button, Icon, Text } from '../../ui'
import { colors } from '../../../theme'
import { AnchoredMenu, useAnchoredMenu } from './AnchoredMenu'

const FORMATS = Object.freeze([
  { id: 'csv', label: 'CSV', hint: 'Spreadsheet-friendly, all columns' },
  { id: 'xlsx', label: 'Excel', hint: 'Formatted, with the current filters applied' },
  { id: 'pdf', label: 'PDF', hint: 'Print layout, visible columns only' },
])

export function ExportMenu({ onExport, label = 'Export', disabled = false }) {
  const { setTrigger, anchor, open, close, isOpen } = useAnchoredMenu()

  return (
    <View ref={setTrigger} collapsable={false}>
      <Button
        variant="secondary"
        size="control"
        icon="download"
        disabled={disabled}
        onPress={() => (isOpen ? close() : open())}
      >
        {label}
      </Button>

      <AnchoredMenu anchor={anchor} onClose={close} width={256}>
        {FORMATS.map((format) => (
          <Pressable
            key={format.id}
            accessibilityRole="menuitem"
            onPress={() => {
              close()
              onExport?.(format.id)
            }}
            style={({ pressed }) => [styles.item, pressed && { backgroundColor: colors.surface.muted }]}
          >
            <View style={{ marginTop: 2 }}>
              <Icon name="file" size={16} color={colors.ink.faint} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>{format.label}</Text>
              <Text style={styles.hint}>{format.hint}</Text>
            </View>
          </Pressable>
        ))}
      </AnchoredMenu>
    </View>
  )
}

const styles = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: 12, paddingVertical: 10 },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '500', color: colors.slate[900] },
  hint: { fontSize: 11, lineHeight: 14, color: colors.ink.faint },
})
