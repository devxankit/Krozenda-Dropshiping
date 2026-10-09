import { useMemo, useState } from 'react'
import { Pressable, StyleSheet, TextInput, View } from 'react-native'
import { Image } from 'expo-image'
import { Badge, Icon, Pagination, Table, Text } from '../../../../components/ui'
import { OptionSheet } from '../../../../components/ui/Select'
import { PageBody } from '../../../../components/admin/shell'
import { colors, fontFamilyFor, shadows } from '../../../../theme'

// The body shared by CategoriesPage and BrandsPage (the two web pages are line-for-line the same
// layout: header, three KPI cards, filter/search/sort/view toolbar, grid or table, pagination).
// Everything that differs between them is passed in through `config`.

const STATUS_TONE = { APPROVED: 'success', PENDING: 'warning', REJECTED: 'danger' }
const PAGE_SIZE = 10
const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'name-asc', label: 'Name (A–Z)' },
  { value: 'name-desc', label: 'Name (Z–A)' },
]

function formatDate(value) {
  if (!value) return 'Recently'
  const date = new Date(value)
  if (isNaN(date.getTime())) return 'Recently'
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
}

const alpha = (hex, a) => hex + a

function Tile({ item, config, size, textSize }) {
  const image = item[config.imageKey]
  const frame = { width: size, height: size, borderRadius: size >= 56 ? 16 : 12 }
  if (image) {
    return (
      <View style={[frame, styles.imgFrame, config.contain && { padding: 4 }, shadows.xs]}>
        <Image source={{ uri: image }} style={{ width: '100%', height: '100%' }} contentFit={config.contain ? 'contain' : 'cover'} />
      </View>
    )
  }
  return (
    <View style={[frame, { alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(config.tintHex, '1a'), borderWidth: 1, borderColor: alpha(config.tintHex, '33') }]}>
      <Text noTranslate style={{ fontSize: textSize, lineHeight: textSize + 6, fontWeight: '700', color: config.tintFg }}>
        {item.name ? item.name.slice(0, 2).toUpperCase() : config.initialsFallback}
      </Text>
    </View>
  )
}

function StatusBadge({ item, style }) {
  return (
    <Badge tone={item.mine ? STATUS_TONE[item.approvalStatus] || 'neutral' : 'success'} dot size="sm" style={style}>
      {item.mine ? item.approvalStatus : 'Approved'}
    </Badge>
  )
}

function Kpi({ label, icon, iconBg, iconRing, iconFg, value, caption, border }) {
  return (
    <View style={[styles.kpi, { borderColor: border }, shadows.xs]}>
      <View style={styles.kpiTop}>
        <Text style={styles.kpiLabel}>{label}</Text>
        <View style={[styles.kpiIcon, { backgroundColor: iconBg, borderColor: iconRing }]}>
          <Icon name={icon} size={20} color={iconFg} />
        </View>
      </View>
      <View style={styles.kpiBottom}>
        <Text noTranslate style={styles.kpiValue}>
          {value}
        </Text>
        <Text style={styles.kpiCaption}>{caption}</Text>
      </View>
    </View>
  )
}

export function CatalogBrowser({ controller, config, onAdd, drawer }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all') // 'all' | 'approved' | 'mine'
  const [sortBy, setSortBy] = useState('newest')
  const [sortOpen, setSortOpen] = useState(false)
  const [viewMode, setViewMode] = useState('grid')
  const [page, setPage] = useState(1)

  const items = useMemo(() => controller.items || [], [controller.items])

  const totalCount = items.length
  const approvedCount = useMemo(() => items.filter((c) => c.approvalStatus === 'APPROVED').length, [items])
  const mineCount = useMemo(() => items.filter((c) => c.mine).length, [items])
  const pendingCount = useMemo(() => items.filter((c) => c.mine && c.approvalStatus === 'PENDING').length, [items])

  const filtered = useMemo(() => {
    const list = items.filter((item) => {
      if (statusFilter === 'approved' && item.approvalStatus !== 'APPROVED') return false
      if (statusFilter === 'mine' && !item.mine) return false
      if (searchQuery.trim()) {
        return Boolean(item.name?.toLowerCase().includes(searchQuery.toLowerCase().trim()))
      }
      return true
    })

    return [...list].sort((a, b) => {
      if (sortBy === 'name-asc') return (a.name || '').localeCompare(b.name || '')
      if (sortBy === 'name-desc') return (b.name || '').localeCompare(a.name || '')
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    })
  }, [items, statusFilter, searchQuery, sortBy])

  const filterKey = `${statusFilter}|${searchQuery}|${sortBy}`
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey)
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey)
    setPage(1)
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const paged = useMemo(() => filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE), [filtered, currentPage])

  const FILTER_TABS = [
    { id: 'all', label: config.allLabel, count: totalCount },
    { id: 'approved', label: 'Approved', count: approvedCount },
    { id: 'mine', label: 'Added by Me', count: mineCount },
  ]

  const tableColumns = [
    {
      key: 'name',
      header: config.detailsHeader,
      render: (item) => (
        <View style={styles.cellRow}>
          <Tile item={item} config={config} size={44} textSize={14} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={styles.cellName}>
              {item.name}
            </Text>
            {item.mine && item.approvalStatus === 'REJECTED' && item.rejectionReason ? (
              <Text numberOfLines={1} style={styles.rejected}>
                {item.rejectionReason}
              </Text>
            ) : null}
          </View>
        </View>
      ),
    },
    {
      key: 'createdAt',
      header: config.dateHeader,
      width: config.dateWidth,
      render: (item) => (
        <Text noTranslate style={styles.cellDate}>
          {formatDate(item.createdAt)}
        </Text>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: config.statusWidth,
      render: (item) => <StatusBadge item={item} />,
    },
  ]

  const filtering = Boolean(searchQuery) || statusFilter !== 'all'
  const sortLabel = SORT_OPTIONS.find((o) => o.value === sortBy)?.label

  return (
    <PageBody>
      <View style={{ gap: 6 }}>
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={styles.titleText}>{config.title}</Text>
            <View style={styles.countPill}>
              <Text noTranslate style={styles.countPillText}>
                {totalCount}
              </Text>
            </View>
          </View>
          <Text numberOfLines={2} style={styles.headerDesc}>
            {config.description}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
          <Pressable onPress={onAdd} accessibilityRole="button" style={({ pressed }) => [styles.addBtn, shadows.sm, pressed && { backgroundColor: colors.brand[700] }]}>
            <Icon name="add" size={14} color="#fff" />
            <Text style={styles.addText}>{config.addLabel}</Text>
          </Pressable>
        </View>
      </View>

      {/* KPI Metric Cards */}
      <View style={{ gap: 16 }}>
        <Kpi
          label={config.kpiTotal}
          icon={config.kpiIcon}
          iconBg={config.kpiIconBg}
          iconRing={config.kpiIconRing}
          iconFg={config.kpiIconFg}
          value={totalCount}
          caption="usable for products"
          border="rgba(226,232,240,0.8)"
        />
        <Kpi
          label="Approved"
          icon="check"
          iconBg={colors.success[50]}
          iconRing="rgba(34,197,94,0.1)"
          iconFg={colors.success[600]}
          value={approvedCount}
          caption={config.approvedCaption}
          border="rgba(226,232,240,0.8)"
        />
        <Kpi
          label="Your Pending"
          icon="pending"
          iconBg={colors.warning[50]}
          iconRing="rgba(245,158,11,0.1)"
          iconFg={colors.warning[600]}
          value={pendingCount}
          caption="awaiting admin review"
          border="rgba(226,232,240,0.8)"
        />
      </View>

      {/* Smart Toolbar */}
      <View style={[styles.toolbar, shadows.xs]}>
        <View style={styles.tabsRow}>
          {FILTER_TABS.map((tab) => {
            const isSelected = statusFilter === tab.id
            return (
              <Pressable
                key={tab.id}
                onPress={() => setStatusFilter(tab.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                style={[styles.tab, isSelected ? [{ backgroundColor: colors.slate[900] }, shadows.xs] : { backgroundColor: colors.slate[50] }]}
              >
                <Text style={{ fontSize: 12, lineHeight: 16, fontWeight: '600', color: isSelected ? '#fff' : colors.slate[600] }}>{tab.label}</Text>
                <View style={[styles.tabCount, { backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : colors.slate[200] }]}>
                  <Text noTranslate style={{ fontSize: 11, lineHeight: 16, fontWeight: '700', color: isSelected ? '#fff' : colors.slate[700] }}>
                    {tab.count}
                  </Text>
                </View>
              </Pressable>
            )
          })}
        </View>

        <View style={styles.controlsRow}>
          <View style={styles.searchWrap}>
            <View pointerEvents="none" style={styles.searchIcon}>
              <Icon name="search" size={14} color={colors.slate[400]} />
            </View>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={config.searchPlaceholder}
              placeholderTextColor={colors.slate[400]}
              style={styles.searchInput}
              returnKeyType="search"
            />
            {searchQuery ? (
              <Pressable onPress={() => setSearchQuery('')} accessibilityLabel="Clear search" hitSlop={8} style={styles.searchClear}>
                <Icon name="close" size={14} color={colors.slate[400]} />
              </Pressable>
            ) : null}
          </View>

          <Pressable onPress={() => setSortOpen(true)} accessibilityRole="button" style={styles.sortBtn}>
            <Text style={{ fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.slate[700] }}>{sortLabel}</Text>
            <Icon name="chevronDown" size={14} color={colors.slate[400]} />
          </Pressable>

          <View style={styles.viewToggle}>
            {[
              { id: 'grid', icon: 'categories' },
              { id: 'table', icon: 'list' },
            ].map((v) => {
              const on = viewMode === v.id
              return (
                <Pressable
                  key={v.id}
                  onPress={() => setViewMode(v.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={[styles.viewBtn, on && [{ backgroundColor: '#fff', borderWidth: 1, borderColor: 'rgba(226,232,240,0.8)' }, shadows.xs]]}
                >
                  <Icon name={v.icon} size={16} color={on ? colors.brand[600] : colors.slate[500]} />
                </Pressable>
              )
            })}
          </View>
        </View>
      </View>

      {/* Content */}
      {controller.isLoading ? (
        <Text style={styles.loading}>Loading…</Text>
      ) : filtered.length === 0 ? (
        <View style={[styles.empty, shadows.xs]}>
          <View style={styles.emptyIcon}>
            <Icon name={config.emptyIcon} size={28} color={colors.slate[400]} />
          </View>
          <Text style={styles.emptyTitle}>{filtering ? config.emptyFiltered : config.emptyNone}</Text>
          <Text style={styles.emptyDesc}>{filtering ? 'Try adjusting your search or filter tab.' : config.emptyHint}</Text>
        </View>
      ) : viewMode === 'grid' ? (
        <View style={{ gap: 20 }}>
          {paged.map((item) => (
            <View key={item.id} style={[styles.card, shadows.xs]}>
              <View style={[styles.cardImage, config.contain && { padding: 20 }]}>
                {item[config.imageKey] ? (
                  <Image
                    source={{ uri: item[config.imageKey] }}
                    style={{ width: '100%', height: '100%' }}
                    contentFit={config.contain ? 'contain' : 'cover'}
                  />
                ) : (
                  <View
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 16,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: alpha(config.tintHex, '1a'),
                      borderWidth: 1,
                      borderColor: alpha(config.tintHex, '33'),
                    }}
                  >
                    <Text noTranslate style={{ fontSize: 20, lineHeight: 28, fontWeight: '700', color: config.tintFg }}>
                      {item.name ? item.name.slice(0, 2).toUpperCase() : config.initialsFallback}
                    </Text>
                  </View>
                )}
                <StatusBadge
                  item={item}
                  style={{ position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(255,255,255,0.95)', borderColor: 'rgba(255,255,255,0.8)' }}
                />
              </View>

              <View style={{ marginTop: 14, minWidth: 0 }}>
                <Text numberOfLines={1} style={styles.cardName}>
                  {item.name}
                </Text>
                <View style={styles.metaRow}>
                  <View style={styles.metaDate}>
                    <Icon name="calendar" size={12} color={colors.slate[400]} />
                    <Text noTranslate style={styles.metaText}>
                      {formatDate(item.createdAt)}
                    </Text>
                  </View>
                  {item.mine ? (
                    <View style={[styles.chip, { backgroundColor: colors.brand[50] }]}>
                      <Text style={[styles.chipText, { color: colors.brand[700] }]}>Added by you</Text>
                    </View>
                  ) : null}
                  {config.showFood && item.isFood ? (
                    <View style={[styles.chip, { backgroundColor: colors.warning[50] }]}>
                      <Text style={[styles.chipText, { color: colors.warning[700] }]}>Food · FSSAI</Text>
                    </View>
                  ) : null}
                </View>
                {config.showFood && item.mine && item.isFood && item.approvalStatus === 'PENDING' ? (
                  <Text style={[styles.note, { color: colors.warning[700] }]}>Approved only after your FSSAI licence is approved (Store Profile).</Text>
                ) : null}
                {item.mine && item.approvalStatus === 'REJECTED' && item.rejectionReason ? (
                  <Text style={[styles.note, { color: colors.danger[600] }]}>{item.rejectionReason}</Text>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.tableBox}>
          <Table style={{ borderRadius: 0, borderWidth: 0 }} columns={tableColumns} data={paged} getRowKey={(item) => item.id} density="comfortable" />
        </View>
      )}

      {filtered.length > 0 ? (
        <Pagination page={currentPage} totalPages={totalPages} totalItems={filtered.length} rowsPerPage={PAGE_SIZE} onPageChange={setPage} itemLabel={config.itemLabel} />
      ) : null}

      <OptionSheet
        visible={sortOpen}
        onClose={() => setSortOpen(false)}
        options={SORT_OPTIONS}
        value={sortBy}
        onSelect={(option) => {
          setSortBy(option.value)
          setSortOpen(false)
        }}
      />

      {drawer}
    </PageBody>
  )
}

const styles = StyleSheet.create({
  headerDesc: { marginTop: 2, fontSize: 12, lineHeight: 18, color: colors.ink.subtle },
  titleText: { fontSize: 16, lineHeight: 24, fontWeight: '700', letterSpacing: -0.4, color: colors.slate[900] },
  countPill: { borderRadius: 9999, borderWidth: 1, borderColor: 'rgba(226,232,240,0.7)', backgroundColor: colors.slate[100], paddingHorizontal: 10, paddingVertical: 2 },
  countPillText: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.slate[600] },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 12,
    backgroundColor: colors.brand[600],
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  addText: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: '#fff' },
  kpi: { borderRadius: 16, borderWidth: 1, backgroundColor: '#fff', padding: 20 },
  kpiTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kpiLabel: { fontSize: 11, lineHeight: 16, fontWeight: '700', letterSpacing: 0.55, textTransform: 'uppercase', color: colors.slate[400] },
  kpiIcon: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  kpiBottom: { marginTop: 12, flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  kpiValue: { fontSize: 30, lineHeight: 36, fontWeight: '800', letterSpacing: -0.75, color: colors.slate[900], fontVariant: ['tabular-nums'] },
  kpiCaption: { fontSize: 12, lineHeight: 16, fontWeight: '500', color: colors.slate[500] },
  toolbar: { gap: 12, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(226,232,240,0.8)', backgroundColor: '#fff', padding: 14 },
  tabsRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 },
  tabCount: { borderRadius: 9999, paddingHorizontal: 6, paddingVertical: 2 },
  controlsRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  searchWrap: { width: '100%', justifyContent: 'center' },
  searchIcon: { position: 'absolute', left: 12, zIndex: 1 },
  searchInput: {
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.slate[200],
    backgroundColor: 'rgba(248,250,252,0.6)',
    paddingVertical: 8,
    paddingLeft: 36,
    paddingRight: 32,
    fontSize: 12,
    lineHeight: 16,
    color: colors.slate[900],
    fontFamily: fontFamilyFor('500'),
  },
  searchClear: { position: 'absolute', right: 10 },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.slate[200],
    backgroundColor: 'rgba(248,250,252,0.6)',
    paddingLeft: 12,
    paddingRight: 10,
    paddingVertical: 8,
  },
  viewToggle: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: colors.slate[200], backgroundColor: 'rgba(241,245,249,0.7)', padding: 2 },
  viewBtn: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  loading: { fontSize: 12, lineHeight: 16, color: colors.ink.subtle },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.slate[200],
    backgroundColor: '#fff',
    paddingVertical: 64,
    paddingHorizontal: 16,
  },
  emptyIcon: { width: 56, height: 56, borderRadius: 16, borderWidth: 1, borderColor: colors.slate[200], backgroundColor: colors.slate[100], alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  emptyTitle: { fontSize: 16, lineHeight: 24, fontWeight: '600', color: colors.slate[900], textAlign: 'center' },
  emptyDesc: { marginTop: 4, maxWidth: 384, fontSize: 12, lineHeight: 16, color: colors.slate[500], textAlign: 'center' },
  card: { borderRadius: 16, borderWidth: 1, borderColor: 'rgba(226,232,240,0.8)', backgroundColor: '#fff', padding: 16 },
  cardImage: {
    width: '100%',
    aspectRatio: 16 / 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.slate[100],
    backgroundColor: colors.slate[100],
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cardName: { fontSize: 16, lineHeight: 24, fontWeight: '700', color: colors.slate[900] },
  metaRow: { marginTop: 4, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  metaDate: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 11, lineHeight: 16, fontWeight: '500', color: colors.slate[400] },
  chip: { borderRadius: 9999, paddingHorizontal: 6, paddingVertical: 2 },
  chipText: { fontSize: 11, lineHeight: 16, fontWeight: '600' },
  note: { marginTop: 6, fontSize: 11, lineHeight: 16 },
  tableBox: { overflow: 'hidden', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(226,232,240,0.9)', backgroundColor: '#fff' },
  cellRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 4 },
  cellName: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: colors.slate[900] },
  cellDate: { fontSize: 12, lineHeight: 16, fontWeight: '500', color: colors.slate[500] },
  rejected: { fontSize: 11, lineHeight: 16, color: colors.danger[600] },
  imgFrame: { borderWidth: 1, borderColor: 'rgba(226,232,240,0.8)', backgroundColor: colors.slate[50], overflow: 'hidden' },
})
