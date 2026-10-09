import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native'
import { Button, Icon, Sheet, Text } from '../../ui'
import { colors, fontFamilyFor, radius, shadows } from '../../../theme'

// filters: [{ key, label, type: 'select', options: [{ value, label }] }]
// value:   { search: '', <key>: value }
//
// Driven entirely by a schema so a new list screen adds a filter by adding a row to its
// FILTER_SCHEMA. The web's <select> becomes a pill that opens an option sheet.
export function FilterBar({ filters = [], value = {}, onChange, searchPlaceholder = 'Search…', actions }) {
  const [openKey, setOpenKey] = useState(null)

  function set(key, next) {
    onChange({ ...value, [key]: next })
  }

  const openFilter = filters.find((filter) => filter.key === openKey)

  return (
    <View style={styles.bar}>
      <View style={styles.searchWrap}>
        <View pointerEvents="none" style={styles.searchIcon}>
          <Icon name="search" size={14} color={colors.ink.faint} />
        </View>
        <TextInput
          value={value.search || ''}
          onChangeText={(text) => set('search', text)}
          placeholder={searchPlaceholder}
          placeholderTextColor={colors.ink.faint}
          accessibilityLabel={searchPlaceholder}
          returnKeyType="search"
          autoCorrect={false}
          style={styles.search}
        />
        {value.search ? (
          <Pressable
            onPress={() => set('search', '')}
            accessibilityLabel="Clear search"
            hitSlop={8}
            style={styles.searchClear}
          >
            <Icon name="close" size={12} color={colors.ink.faint} />
          </Pressable>
        ) : null}
      </View>

      {filters.map((filter) => {
        const active = Boolean(value[filter.key])
        const display = active
          ? filter.options.find((option) => option.value === value[filter.key])?.label || value[filter.key]
          : filter.label
        return (
          <Pressable
            key={filter.key}
            accessibilityRole="button"
            accessibilityLabel={filter.label}
            onPress={() => setOpenKey(filter.key)}
            style={[styles.select, active ? styles.selectActive : styles.selectIdle]}
          >
            <Text
              numberOfLines={1}
              style={[styles.selectText, active ? { fontWeight: '600', color: colors.brand[700] } : { color: colors.ink.muted }]}
            >
              {display}
            </Text>
            <View pointerEvents="none" style={styles.selectChevron}>
              <Icon name="chevronDown" size={12} color={colors.ink.faint} />
            </View>
          </Pressable>
        )
      })}

      {actions ? <View style={styles.actions}>{actions}</View> : null}

      <Sheet visible={Boolean(openFilter)} onClose={() => setOpenKey(null)} maxHeight="70%">
        {openFilter ? (
          <View>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>{openFilter.label}</Text>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              {[{ value: '', label: openFilter.label }, ...openFilter.options].map((option) => {
                const selected = (value[openFilter.key] || '') === option.value
                return (
                  <Pressable
                    key={`${option.value}`}
                    onPress={() => {
                      set(openFilter.key, option.value)
                      setOpenKey(null)
                    }}
                    style={({ pressed }) => [styles.option, pressed && { backgroundColor: colors.surface.muted }]}
                  >
                    <Text style={[styles.optionText, selected && { fontWeight: '600', color: colors.brand[700] }]}>
                      {option.label}
                    </Text>
                    {selected ? <Icon name="check" size={16} color={colors.brand[600]} /> : null}
                  </Pressable>
                )
              })}
            </ScrollView>
          </View>
        ) : null}
      </Sheet>
    </View>
  )
}

// The applied filters, as removable chips.
export function FilterChips({ filters = [], value = {}, onChange, onClear }) {
  const applied = filters
    .filter((filter) => value[filter.key])
    .map((filter) => ({
      key: filter.key,
      label: filter.label,
      display: filter.options.find((option) => option.value === value[filter.key])?.label || value[filter.key],
    }))

  if (applied.length === 0) return null

  return (
    <View style={styles.chips}>
      <Text style={{ fontSize: 12, lineHeight: 16, color: colors.ink.subtle }}>Filtered by</Text>
      {applied.map((chip) => (
        <View key={chip.key} style={styles.chip}>
          <Text noTranslate style={styles.chipText}>
            {`${chip.label}: ${chip.display}`}
          </Text>
          <Pressable
            onPress={() => onChange({ ...value, [chip.key]: '' })}
            accessibilityLabel={`Remove ${chip.label} filter`}
            hitSlop={8}
            style={styles.chipClose}
          >
            <Icon name="close" size={12} color={colors.brand[700]} />
          </Pressable>
        </View>
      ))}
      <Button variant="ghost" size="xs" onPress={onClear}>
        Clear all
      </Button>
    </View>
  )
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  searchWrap: { width: '100%', justifyContent: 'center' },
  searchIcon: { position: 'absolute', left: 10, zIndex: 1 },
  search: {
    height: 34, width: '100%', borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border.DEFAULT,
    backgroundColor: colors.surface.DEFAULT, paddingLeft: 32, paddingRight: 28, paddingVertical: 0,
    fontSize: 12, color: colors.slate[900], fontFamily: fontFamilyFor('400'), ...shadows.xs,
  },
  searchClear: { position: 'absolute', right: 8, height: 16, width: 16, alignItems: 'center', justifyContent: 'center' },
  select: {
    flexGrow: 1, flexBasis: 0, minWidth: 120, height: 34, justifyContent: 'center', borderRadius: radius.xl,
    borderWidth: 1, paddingLeft: 10, paddingRight: 28, ...shadows.xs,
  },
  selectIdle: { borderColor: colors.border.DEFAULT, backgroundColor: colors.surface.DEFAULT },
  selectActive: { borderColor: colors.brand[200], backgroundColor: colors.brand[50] },
  selectText: { fontSize: 12, lineHeight: 16 },
  selectChevron: { position: 'absolute', right: 8 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  sheetHead: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  sheetTitle: { fontSize: 16, lineHeight: 24, fontWeight: '600', color: colors.slate[900] },
  option: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  optionText: { fontSize: 14, lineHeight: 20, color: colors.slate[700] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  chip: {
    height: 28, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 9999, borderWidth: 1,
    borderColor: colors.brand[100], backgroundColor: colors.brand[50], paddingLeft: 12, paddingRight: 6,
  },
  chipText: { fontSize: 12, lineHeight: 16, fontWeight: '500', color: colors.brand[700] },
  chipClose: { height: 16, width: 16, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
})
