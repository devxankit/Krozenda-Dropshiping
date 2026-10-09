import { useState } from 'react'
import { Pressable, ScrollView, View, StyleSheet } from 'react-native'
import { colors, radius } from '../../theme'
import { Text } from './Text'
import { Icon } from './Icon'
import { Checkbox } from './Checkbox'
import { Skeleton } from './Skeleton'

// columns: [{ key, header, render?(row, index), align?, width?, sortable?, exportValue? }]
// Same contract as the web Table. At phone width the web table is wider than the screen and scrolls
// sideways; here it is a horizontal ScrollView. Column width = `width` (number, "120px" or "7.5rem")
// else DEFAULT_COL_WIDTH; when the columns do not fill the screen they are stretched to fit.
// Sorting and selection are controlled. `onRowClick` (alias `onRowPress`) is called with the row.
const DEFAULT_COL_WIDTH = 120
const CHECK_COL_WIDTH = 40

// Phone-width values of the web DENSITY / HEADER_DENSITY classes.
const DENSITY = {
  relaxed: { cell: { minHeight: 48, paddingHorizontal: 12, paddingVertical: 8 }, fs: 12, head: { height: 40, paddingHorizontal: 12 }, hfs: 11 },
  comfortable: { cell: { minHeight: 44, paddingHorizontal: 12, paddingVertical: 8 }, fs: 12, head: { height: 36, paddingHorizontal: 12 }, hfs: 11 },
  default: { cell: { minHeight: 40, paddingHorizontal: 10, paddingVertical: 8 }, fs: 12, head: { height: 34, paddingHorizontal: 10 }, hfs: 10 },
  compact: { cell: { minHeight: 32, paddingHorizontal: 8, paddingVertical: 8 }, fs: 11, head: { height: 28, paddingHorizontal: 8 }, hfs: 9 },
}
const ALIGN = { left: 'flex-start', right: 'flex-end', center: 'center' }
const TEXT_ALIGN = { left: 'left', right: 'right', center: 'center' }
const SKELETON_WIDTHS = [144, 96, 176, 112]

function colWidth(column) {
  const w = column.width
  if (typeof w === 'number') return w
  if (typeof w === 'string') {
    const px = /^(\d+(?:\.\d+)?)px$/.exec(w.trim())
    if (px) return Number(px[1])
    const rem = /^(\d+(?:\.\d+)?)rem$/.exec(w.trim())
    if (rem) return Number(rem[1]) * 16
    if (/^\d+(?:\.\d+)?$/.test(w.trim())) return Number(w)
  }
  return DEFAULT_COL_WIDTH
}

function SortIndicator({ state }) {
  if (!state) {
    return (
      <View style={{ transform: [{ rotate: '90deg' }] }}>
        <Icon name="chevronsRight" size={12} color={colors.border.strong} />
      </View>
    )
  }
  return <Icon name={state === 'asc' ? 'chevronUp' : 'chevronDown'} size={12} color={colors.brand[600]} />
}

export function Table({
  columns = [],
  data = [],
  getRowKey = (row, index) => index,
  sort = null,
  onSortChange,
  selectable = false,
  selectedKeys = [],
  onSelectionChange,
  onRowClick,
  onRowPress,
  density = 'default',
  isLoading = false,
  skeletonRows = 6,
  emptyState = null,
  style,
}) {
  const [outer, setOuter] = useState(0)
  const selected = new Set(selectedKeys)
  const allKeys = data.map(getRowKey)
  const allSelected = data.length > 0 && allKeys.every((key) => selected.has(key))
  const someSelected = !allSelected && allKeys.some((key) => selected.has(key))
  const d = DENSITY[density] || DENSITY.default
  const press = onRowClick || onRowPress

  const base = columns.map(colWidth)
  const fixed = selectable ? CHECK_COL_WIDTH : 0
  const total = base.reduce((a, b) => a + b, 0) + fixed
  const extra = outer > total ? (outer - 2 - total) / Math.max(1, base.reduce((a, b) => a + b, 0)) : 0
  const widths = base.map((w) => w + (extra > 0 ? w * extra : 0))
  const tableWidth = Math.max(total, outer - 2)

  function toggleAll() {
    onSelectionChange?.(allSelected ? [] : allKeys)
  }
  function toggleRow(key) {
    const next = new Set(selected)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    onSelectionChange?.([...next])
  }
  function requestSort(column) {
    if (!column.sortable || !onSortChange) return
    const isCurrent = sort?.key === column.key
    onSortChange({ key: column.key, direction: isCurrent && sort.direction === 'asc' ? 'desc' : 'asc' })
  }

  if (!isLoading && data.length === 0 && emptyState) {
    return <View style={[styles.frame, { backgroundColor: colors.surface.DEFAULT }, style]}>{emptyState}</View>
  }

  const cellText = [styles.cellText, { fontSize: d.fs }]

  return (
    <View style={[styles.frame, style]} onLayout={(e) => setOuter(e.nativeEvent.layout.width)}>
      <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator keyboardShouldPersistTaps="handled">
        <View style={{ width: tableWidth }}>
          <View style={[styles.row, styles.headRow]}>
            {selectable ? (
              <View style={[styles.cell, d.head, { width: CHECK_COL_WIDTH, alignItems: 'center' }]}>
                <Checkbox checked={allSelected} indeterminate={someSelected} onChange={toggleAll} />
              </View>
            ) : null}
            {columns.map((column, i) => {
              const state = sort?.key === column.key ? sort.direction : null
              const label = (
                <Text
                  style={{
                    fontSize: d.hfs,
                    fontWeight: '600',
                    letterSpacing: d.hfs * 0.05,
                    textTransform: 'uppercase',
                    color: column.sortable ? colors.ink.muted : colors.ink.subtle,
                    textAlign: TEXT_ALIGN[column.align] || 'left',
                  }}
                >
                  {column.header}
                </Text>
              )
              return (
                <View key={column.key} style={[styles.cell, d.head, { width: widths[i], alignItems: ALIGN[column.align] || 'flex-start' }]}>
                  {column.sortable ? (
                    <Pressable onPress={() => requestSort(column)} style={styles.sortBtn} accessibilityRole="button">
                      {label}
                      <SortIndicator state={state} />
                    </Pressable>
                  ) : (
                    label
                  )}
                </View>
              )
            })}
          </View>

          {isLoading
            ? Array.from({ length: skeletonRows }, (_, index) => (
                <View key={`skeleton-${index}`} style={[styles.row, styles.bodyRow]}>
                  {selectable ? (
                    <View style={[styles.cell, d.cell, { width: CHECK_COL_WIDTH, alignItems: 'center' }]}>
                      <Skeleton style={{ width: 16, height: 16 }} />
                    </View>
                  ) : null}
                  {columns.map((column, ci) => (
                    <View key={column.key} style={[styles.cell, d.cell, { width: widths[ci], alignItems: ALIGN[column.align] || 'flex-start' }]}>
                      <Skeleton style={{ height: 12, width: '100%', maxWidth: SKELETON_WIDTHS[(index + ci) % SKELETON_WIDTHS.length] }} />
                    </View>
                  ))}
                </View>
              ))
            : data.map((row, index) => {
                const key = getRowKey(row, index)
                const isSelected = selected.has(key)
                const Row = press ? Pressable : View
                return (
                  <Row
                    key={key}
                    onPress={press ? () => press(row) : undefined}
                    style={[styles.row, styles.bodyRow, index === data.length - 1 && { borderBottomWidth: 0 }, isSelected && { backgroundColor: 'rgba(239,246,255,0.7)' }]}
                  >
                    {selectable ? (
                      <View style={[styles.cell, d.cell, { width: CHECK_COL_WIDTH, alignItems: 'center' }]}>
                        <Checkbox checked={isSelected} onChange={() => toggleRow(key)} />
                      </View>
                    ) : null}
                    {columns.map((column, ci) => {
                      const content = column.render ? column.render(row, index) : row[column.key]
                      return (
                        <View key={column.key} style={[styles.cell, d.cell, { width: widths[ci], alignItems: ALIGN[column.align] || 'flex-start' }]}>
                          {typeof content === 'string' || typeof content === 'number' ? (
                            <Text style={[cellText, { textAlign: TEXT_ALIGN[column.align] || 'left' }]}>{content}</Text>
                          ) : (
                            content
                          )}
                        </View>
                      )
                    })}
                  </Row>
                )
              })}
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden', borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border.DEFAULT },
  row: { flexDirection: 'row', alignItems: 'stretch' },
  headRow: { backgroundColor: colors.surface.muted, borderBottomWidth: 1, borderBottomColor: colors.border.DEFAULT },
  bodyRow: { backgroundColor: colors.surface.DEFAULT, borderBottomWidth: 1, borderBottomColor: colors.border.subtle },
  cell: { justifyContent: 'center' },
  cellText: { color: colors.slate[800] },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
})
