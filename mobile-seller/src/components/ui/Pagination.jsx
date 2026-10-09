import { useState } from 'react'
import { Pressable, View, StyleSheet } from 'react-native'
import { colors, radius, shadows } from '../../theme'
import { Text } from './Text'
import { Icon } from './Icon'
import { OptionSheet } from './Select'
import { formatIndian } from '../../lib/format'

const ROWS_PER_PAGE_OPTIONS = [25, 50, 100].map((n) => ({ value: n, label: String(n) }))
const SIZES = { compact: 32, touch: 40 }

function Strong({ children }) {
  return (
    <Text noTranslate style={styles.strong}>
      {children}
    </Text>
  )
}

// Port of components/ui/Pagination.jsx (phone layout: prev, "page / total", next).
export function Pagination({
  page,
  totalPages,
  onPageChange,
  totalItems,
  rowsPerPage,
  onRowsPerPageChange,
  itemLabel = 'results',
  size = 'compact',
  style,
}) {
  const [rowsOpen, setRowsOpen] = useState(false)
  const box = SIZES[size] || SIZES.compact
  const canPrev = page > 1
  const canNext = page < totalPages
  const from = rowsPerPage ? (page - 1) * rowsPerPage + 1 : null
  const to = rowsPerPage && totalItems ? Math.min(page * rowsPerPage, totalItems) : null

  const arrow = (name, enabled, target, label) => (
    <Pressable
      disabled={!enabled}
      onPress={() => onPageChange(target)}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.arrow,
        shadows.xs,
        { width: box, height: box, opacity: enabled ? 1 : 0.4 },
        pressed && { backgroundColor: colors.surface.muted },
      ]}
    >
      <Icon name={name} size={16} color={colors.ink.muted} />
    </Pressable>
  )

  return (
    <View style={[styles.wrap, style]}>
      <Text style={styles.summary}>
        {totalItems === 0 ? (
          <>
            <Strong>0</Strong> {itemLabel}
          </>
        ) : totalItems !== undefined && from !== null ? (
          <>
            Showing{' '}
            <Strong>
              {from}–{to}
            </Strong>{' '}
            of <Strong>{formatIndian(totalItems)}</Strong> {itemLabel}
          </>
        ) : (
          <>
            Page <Strong>{page}</Strong> of <Strong>{totalPages}</Strong>
          </>
        )}
      </Text>

      <View style={styles.controls}>
        {onRowsPerPageChange ? (
          <>
            <Pressable onPress={() => setRowsOpen(true)} style={[styles.rows, shadows.xs]} accessibilityRole="button">
              <Text noTranslate style={{ fontSize: 12, color: colors.slate[900] }}>
                {rowsPerPage}
              </Text>
              <Icon name="chevronDown" size={12} color={colors.ink.faint} />
            </Pressable>
            <OptionSheet
              visible={rowsOpen}
              onClose={() => setRowsOpen(false)}
              title="Rows"
              options={ROWS_PER_PAGE_OPTIONS}
              value={rowsPerPage}
              onSelect={(option) => {
                setRowsOpen(false)
                onRowsPerPageChange(Number(option.value))
              }}
            />
          </>
        ) : null}
        <View style={styles.nav}>
          {arrow('chevronLeft', canPrev, page - 1, 'Previous page')}
          <Text noTranslate style={styles.pageOf}>
            {page} / {totalPages}
          </Text>
          {arrow('chevronRight', canNext, page + 1, 'Next page')}
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  summary: { fontSize: 12, lineHeight: 16, color: colors.ink.subtle },
  strong: { fontWeight: '600', color: colors.slate[900] },
  controls: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 },
  nav: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  arrow: { alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: colors.border.DEFAULT, backgroundColor: colors.surface.DEFAULT },
  pageOf: { paddingHorizontal: 8, fontSize: 12, color: colors.ink.subtle },
  rows: { height: 32, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border.DEFAULT, backgroundColor: colors.surface.DEFAULT },
})
