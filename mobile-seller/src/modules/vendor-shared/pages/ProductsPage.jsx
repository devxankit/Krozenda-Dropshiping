import { useEffect, useState } from 'react'
import { Animated, Easing, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native'
import { Image } from 'expo-image'
import { Badge, Icon, Pagination, Table, Text, resolveImageSource } from '../../../components/ui'
import { PageBody } from '../../../components/admin/shell'
import { useVendorProductsController } from '../controllers/useVendorController'
import { VENDOR_PRODUCT_COLUMNS, VENDOR_PRODUCT_TABS } from '../tableColumns/catalogColumns'
import { AddVendorProductModal } from '../components/modals/AddVendorProductModal'
import { EditVendorProductModal } from '../components/modals/EditVendorProductModal'
import { UpdateStockModal } from '../components/modals/UpdateStockModal'
import { VendorProductDetailModal } from '../components/modals/VendorProductDetailModal'
import { ScanBarcodeModal } from '../../../components/common/ScanBarcodeModal'
import { downloadTableCsv } from '../../admin/lib/exportCsv'
import { ConfirmDialog } from '../../../components/admin/overlay/ConfirmDialog'
import { toast } from '../../../lib/toast'
import { AdminImportModal } from '../../catalog-import/components/AdminImportModal'
import { IMPORT_BASE, useApprovePreviewProducts } from '../../catalog-import/controllers/useProductImportController'
import { formatRupees, withAlpha } from '../../../components/catalog/tw'
import { colors, fontFamilyFor, radius, shadows } from '../../../theme'

const STATUS_TONE = { PENDING: 'warning', REJECTED: 'danger' }

// What approving a seller's CSV preview does: submits it, exactly like adding
// the product by hand.
const APPROVE_NOTE =
  'Check each one (view, edit or delete), then press Approve to submit it — it goes live once the platform approves it, or straight away if auto-approval is on.'

function PreviewBadge({ floating = false }) {
  return (
    <View style={[styles.previewBadge, floating && shadows.xs]}>
      <View style={styles.previewDot} />
      <Text style={styles.previewBadgeText}>Preview · Draft</Text>
    </View>
  )
}

function ApproveButton({ onPress, disabled }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel="Approve — submit this imported product"
      style={({ pressed }) => [styles.approveBtn, shadows.xs, disabled && { opacity: 0.5 }, pressed && { backgroundColor: colors.success[700] }]}
    >
      <Icon name="check" size={12} color="#fff" />
      <Text style={styles.approveText}>Approve</Text>
    </Pressable>
  )
}

function DeletePreviewButton({ onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel="Delete this imported preview"
      style={({ pressed }) => [styles.deletePreview, shadows['2xs'], pressed && { backgroundColor: colors.danger[50] }]}
    >
      <Icon name="delete" size={14} color={colors.slate[500]} />
    </Pressable>
  )
}

// Page-header action button: icon only at phone width (the label is `hidden sm:inline`).
function HeaderButton({ icon, label, onPress, disabled, primary, spin }) {
  const [rotation] = useState(() => new Animated.Value(0))
  useEffect(() => {
    if (!spin) {
      rotation.setValue(0)
      return undefined
    }
    const loop = Animated.loop(Animated.timing(rotation, { toValue: 1, duration: 1000, easing: Easing.linear, useNativeDriver: true }))
    loop.start()
    return () => loop.stop()
  }, [spin, rotation])
  const rotate = rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] })

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.headerBtn,
        shadows.xs,
        primary ? styles.headerBtnPrimary : styles.headerBtnSecondary,
        primary ? pressed && { backgroundColor: colors.brand[700] } : pressed && { backgroundColor: colors.slate[50] },
        disabled && { opacity: 0.5 },
      ]}
    >
      <Animated.View style={spin ? { transform: [{ rotate }] } : undefined}>
        <Icon name={icon} size={14} color={primary ? '#fff' : spin ? colors.brand[600] : colors.slate[600]} />
      </Animated.View>
      {primary ? <Text style={styles.headerBtnPrimaryText}>{label}</Text> : null}
    </Pressable>
  )
}

function Kpi({ label, labelColor = colors.slate[400], border, tileBg, tileFg, tileRing, icon, value, unit, unitPill, dot, footer, wide }) {
  return (
    <View style={[styles.kpi, shadows.xs, { borderColor: border }, wide && { width: '100%' }]}>
      <View style={styles.kpiTop}>
        <Text style={[styles.kpiLabel, { color: labelColor }]}>{label}</Text>
        <View style={[styles.kpiTile, { backgroundColor: tileBg, borderColor: tileRing }]}>
          <Icon name={icon} size={14} color={tileFg} />
        </View>
      </View>
      <View style={styles.kpiValueRow}>
        <Text noTranslate style={styles.kpiValue}>
          {value}
        </Text>
        {unitPill ? (
          <View style={[styles.kpiPill, { backgroundColor: unitPill.bg }]}>
            <Text style={[styles.kpiPillText, { color: unitPill.fg }]}>{unit}</Text>
          </View>
        ) : (
          <Text style={styles.kpiUnit}>{unit}</Text>
        )}
      </View>
      <View style={styles.kpiFooter}>
        <View style={[styles.kpiDot, { backgroundColor: dot }]} />
        <Text numberOfLines={1} style={styles.kpiFooterText}>
          {footer}
        </Text>
      </View>
    </View>
  )
}

function CardIconButton({ icon, label, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      hitSlop={3}
      style={({ pressed }) => [styles.cardIconBtn, shadows['2xs'], pressed && { backgroundColor: colors.brand[50], borderColor: colors.brand[200] }]}
    >
      <Icon name={icon} size={12} color={colors.slate[500]} />
    </Pressable>
  )
}

function ProductCard({ item, approving, onOpen, onView, onStock, onApprove, onDeletePreview }) {
  const [imageFailed, setImageFailed] = useState(false)
  const primaryImage = item.images?.[0]
  const isPendingOrRejected = item.approvalStatus === 'PENDING' || item.approvalStatus === 'REJECTED'
  const hasDiscount = item.salePrice != null && item.salePrice < item.price
  const discountPct = item.discountPercent || (hasDiscount ? Math.round(((item.price - item.salePrice) / item.price) * 100) : 0)
  const initials = item.name ? item.name.slice(0, 2).toUpperCase() : 'PR'
  const stockColor = item.stock > 10 ? colors.success[500] : item.stock > 0 ? colors.warning[500] : colors.danger[500]

  return (
    <Pressable onPress={onOpen} style={({ pressed }) => [styles.card, shadows.xs, pressed && { borderColor: colors.brand[400] }]}>
      {/* Cover Image Showcase */}
      <View style={styles.cover}>
        {primaryImage && !imageFailed ? (
          <Image source={resolveImageSource(primaryImage)} style={{ height: '100%', width: '100%' }} contentFit="contain" onError={() => setImageFailed(true)} />
        ) : primaryImage ? (
          <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand[50] }]}>
            <Text noTranslate style={styles.initialsFull}>
              {initials}
            </Text>
          </View>
        ) : (
          <View style={styles.initialsBox}>
            <Text noTranslate style={styles.initialsText}>
              {initials}
            </Text>
          </View>
        )}

        {/* Top Floating Badges */}
        <View pointerEvents="none" style={styles.floatBadges}>
          {item.isFlashsale ? (
            <View style={[styles.floatPill, { backgroundColor: withAlpha(colors.warning[500], 0.95) }]}>
              <Text noTranslate style={styles.floatPillText}>
                🔥
              </Text>
            </View>
          ) : null}
          {item.isTrending ? (
            <View style={[styles.floatPill, { backgroundColor: withAlpha(colors.brand[600], 0.95) }]}>
              <Text noTranslate style={styles.floatPillText}>
                📈
              </Text>
            </View>
          ) : null}
          {discountPct > 0 ? (
            <View style={[styles.floatPill, { backgroundColor: withAlpha(colors.success[600], 0.95) }]}>
              <Text noTranslate style={styles.floatPillText}>
                {discountPct}%
              </Text>
            </View>
          ) : null}
          {item.stock <= 0 ? (
            <View style={[styles.floatPill, { backgroundColor: withAlpha(colors.danger[600], 0.95) }]}>
              <Text style={styles.floatPillText}>Out</Text>
            </View>
          ) : null}
        </View>

        {/* Top Right Status Badge */}
        <View style={styles.statusBadge}>
          {item.importPreview ? (
            <PreviewBadge floating />
          ) : isPendingOrRejected ? (
            <Badge
              tone={STATUS_TONE[item.approvalStatus] || 'neutral'}
              dot
              size="sm"
              style={[styles.whiteBadge, shadows.xs]}
              textStyle={{ fontSize: 9, fontWeight: '700' }}
            >
              {item.approvalStatus === 'PENDING' ? 'Pending' : 'Rejected'}
            </Badge>
          ) : (
            <View
              style={[
                styles.activePill,
                shadows.xs,
                { borderColor: item.isActive ? colors.success[200] : colors.slate[200] },
              ]}
            >
              <View style={[styles.activeDot, { backgroundColor: item.isActive ? colors.success[500] : colors.slate[400] }]} />
              <Text style={[styles.activeText, { color: item.isActive ? colors.success[700] : colors.slate[500] }]}>
                {item.isActive ? 'Active' : 'Hidden'}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Details */}
      <View style={{ marginTop: 8, flex: 1, minWidth: 0 }}>
        <View style={styles.catRow}>
          <Text noTranslate numberOfLines={1} style={styles.catChip}>
            {item.category?.name || 'Catalog'}
          </Text>
          {item.brand?.name ? (
            <Text noTranslate numberOfLines={1} style={styles.brandText}>
              · {item.brand.name}
            </Text>
          ) : null}
        </View>

        <Text noTranslate numberOfLines={2} style={styles.name}>
          {item.name}
        </Text>

        {/* Pricing */}
        <View style={styles.priceRow}>
          <Text noTranslate style={styles.price}>
            {formatRupees(item.salePrice ?? item.price)}
          </Text>
          {hasDiscount ? (
            <Text noTranslate style={styles.mrp}>
              {formatRupees(item.price)}
            </Text>
          ) : null}
        </View>

        {/* Stock status indicator */}
        <View style={styles.stockRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={[styles.stockDot, { backgroundColor: stockColor }]} />
            <Text
              noTranslate={item.stock > 0}
              style={[
                styles.stockText,
                { color: item.stock > 10 ? colors.slate[800] : item.stock > 0 ? colors.warning[600] : colors.danger[600] },
              ]}
            >
              {item.stock > 0 ? item.stock : 'Out'}
            </Text>
          </View>
          {item.sku ? (
            <Text noTranslate numberOfLines={1} style={styles.sku}>
              {item.sku}
            </Text>
          ) : null}
        </View>

        {item.approvalStatus === 'REJECTED' && item.rejectionReason ? (
          <Text numberOfLines={2} style={styles.rejection}>
            {item.rejectionReason}
          </Text>
        ) : null}
      </View>

      {/* Card Bottom Footer */}
      <View style={styles.cardFooter}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={[styles.liveDot, { backgroundColor: item.isActive ? colors.success[500] : colors.slate[300] }]} />
          <Text style={[styles.liveText, { color: item.isActive ? colors.success[700] : colors.slate[400] }]}>
            {item.isActive ? 'Live' : 'Hidden'}
          </Text>
        </View>

        <View style={styles.cardActions}>
          {item.importPreview ? (
            <>
              <ApproveButton disabled={approving} onPress={onApprove} />
              <DeletePreviewButton onPress={onDeletePreview} />
            </>
          ) : null}
          <CardIconButton icon="eye" label="View details & barcode" onPress={onView} />
          <CardIconButton icon="edit" label="Edit product details" onPress={onOpen} />
          <CardIconButton icon="inventory" label="Update stock" onPress={onStock} />
        </View>
      </View>
    </Pressable>
  )
}

function RowIconButton({ icon, label, onPress }) {
  return (
    <Pressable onPress={onPress} accessibilityLabel={label} style={({ pressed }) => [styles.rowIconBtn, pressed && { backgroundColor: colors.brand[50] }]}>
      <Icon name={icon} size={16} color={colors.slate[500]} />
    </Pressable>
  )
}

// Mirrors the admin Products screen's visual language (KPI cards, status
// tabs, search, grid/table toggle, product cards) but the data underneath
// stays vendor-scoped: server-paged /vendor/products, and every product a
// seller creates carries an approval workflow admin products never see —
// "Pending review" / "Rejected" badges and the rejection reason, both kept
// here rather than folded away to look more like admin.
export function VendorProductsPage() {
  const list = useVendorProductsController()
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [editingProduct, setEditingProduct] = useState(null)
  const [viewingProduct, setViewingProduct] = useState(null)
  const [scanOpen, setScanOpen] = useState(false)
  const [viewMode, setViewMode] = useState('grid')
  const [importOpen, setImportOpen] = useState(false)
  const [approveAllOpen, setApproveAllOpen] = useState(false)
  const [deletingPreview, setDeletingPreview] = useState(null)
  const [searchFocused, setSearchFocused] = useState(false)

  const items = list.items || []
  const tabCounts = list.tabCounts || {}
  const searchValue = list.filters?.search || ''
  const previewCount = tabCounts.preview ?? 0

  const setSearch = (value) => list.changeFilters({ ...list.filters, search: value })

  // CSV-imported products arrive as hidden Draft "previews"; approving one
  // submits it (live at once only with auto-approval).
  const approvePreviews = useApprovePreviewProducts(IMPORT_BASE.VENDOR, {
    productQueryKeys: [['vendor', 'products'], ['vendor', 'inventory']],
  })

  async function approveImported(payload) {
    try {
      const res = await approvePreviews.mutateAsync(payload)
      toast.success(res.data?.live ? 'Approved' : 'Submitted for review', res.message)
    } catch (err) {
      toast.error('Could not approve', err.message)
    }
  }

  async function deletePreview(product) {
    try {
      await list.removeProduct(product.id)
      toast.success('Preview deleted', product.name)
    } catch (err) {
      toast.error('Could not delete', err.message)
    }
  }

  async function exportCsv() {
    try {
      await downloadTableCsv('products.csv', VENDOR_PRODUCT_COLUMNS, items)
    } catch {
      toast.error('Could not export the product list')
    }
  }

  // The preview tab only appears while there is something in it (or it is
  // the tab being looked at), like the admin panel's.
  const FILTER_TABS = [
    ...VENDOR_PRODUCT_TABS,
    ...(previewCount > 0 || list.tab === 'preview' ? [{ id: 'preview', label: 'Import Preview' }] : []),
  ].map((tab) => ({ ...tab, count: tabCounts[tab.id] ?? 0 }))

  // Built inline (not in tableColumns/catalogColumns.jsx) so the render fn can
  // close over setEditingProduct/setSelectedProduct — the shared columns file
  // has no component state to reach.
  const tableColumnsWithActions = [
    ...VENDOR_PRODUCT_COLUMNS,
    {
      key: '__actions',
      header: 'Actions',
      width: '15rem',
      align: 'right',
      render: (row) => (
        <View style={styles.rowActions}>
          {row.importPreview ? (
            <>
              <ApproveButton disabled={approvePreviews.isPending} onPress={() => approveImported({ productIds: [row.id] })} />
              <DeletePreviewButton onPress={() => setDeletingPreview(row)} />
            </>
          ) : null}
          <RowIconButton icon="eye" label="View details & barcode" onPress={() => setViewingProduct(row)} />
          <RowIconButton icon="edit" label="Edit product details" onPress={() => setEditingProduct(row)} />
          <RowIconButton icon="inventory" label="Update stock" onPress={() => setSelectedProduct(row)} />
        </View>
      ),
    },
  ]

  const cardRows = []
  for (let i = 0; i < items.length; i += 2) cardRows.push(items.slice(i, i + 2))

  const filtered = Boolean(searchValue || list.tab !== 'all')

  return (
    <>
      <PageBody refreshing={list.isFetching && !list.isLoading} onRefresh={() => list.refetch()}>
        {/* Page header */}
        <View style={{ gap: 6 }}>
          <View style={{ minWidth: 0 }}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>Products</Text>
              <View style={styles.countPill}>
                <Text noTranslate style={styles.countText}>
                  {tabCounts.all ?? list.totalItems ?? 0}
                </Text>
              </View>
            </View>
            <Text numberOfLines={2} style={styles.description}>
              Manage your product listings, pricing and stock. New products go live once an admin approves them.
            </Text>
          </View>
          <View style={styles.headerActions}>
            <HeaderButton icon="refresh" label="Refresh" onPress={() => list.refetch()} disabled={list.isFetching} spin={list.isFetching} />
            <HeaderButton icon="download" label="Export" onPress={exportCsv} />
            <HeaderButton icon="search" label="Scan barcode" onPress={() => setScanOpen(true)} />
            <HeaderButton icon="upload" label="Import CSV" onPress={() => setImportOpen(true)} />
            <HeaderButton icon="add" label="Add Product" onPress={() => setAddModalOpen(true)} primary />
          </View>
        </View>

        {/* KPI Metric Cards */}
        <View style={styles.kpiGrid}>
          <View style={styles.kpiCell}>
            <Kpi
              label="Total"
              border={withAlpha(colors.slate[200], 0.8)}
              tileBg={colors.slate[100]}
              tileFg={colors.slate[700]}
              tileRing={colors.slate[200]}
              icon="products"
              value={tabCounts.all ?? 0}
              unit="items"
              dot={colors.slate[500]}
              footer="Catalog listings"
            />
          </View>
          <View style={styles.kpiCell}>
            <Kpi
              label="Active"
              border={withAlpha(colors.slate[200], 0.8)}
              tileBg={colors.success[50]}
              tileFg={colors.success[600]}
              tileRing={withAlpha(colors.success[500], 0.1)}
              icon="check"
              value={tabCounts.active ?? 0}
              unit="live"
              dot={colors.success[500]}
              footer="Storefront visible"
            />
          </View>
          <View style={styles.kpiCell}>
            <Kpi
              label="Pending"
              labelColor={colors.warning[700]}
              border={withAlpha(colors.warning[200], 0.8)}
              tileBg={colors.warning[50]}
              tileFg={colors.warning[600]}
              tileRing={withAlpha(colors.warning[500], 0.2)}
              icon="pending"
              value={tabCounts.pending ?? 0}
              unit="Review"
              unitPill={{ bg: colors.warning[50], fg: colors.warning[700] }}
              dot={tabCounts.pending > 0 ? colors.warning[500] : colors.slate[300]}
              footer="Awaiting admin"
            />
          </View>
          <View style={styles.kpiCell}>
            <Kpi
              label="Rejected"
              border={withAlpha(colors.slate[200], 0.8)}
              tileBg={colors.danger[50]}
              tileFg={colors.danger[600]}
              tileRing={withAlpha(colors.danger[500], 0.1)}
              icon="warning"
              value={tabCounts.rejected ?? 0}
              unit="issues"
              dot={tabCounts.rejected > 0 ? colors.danger[500] : colors.success[500]}
              footer={tabCounts.rejected > 0 ? 'Needs changes' : 'None'}
            />
          </View>
          <Kpi
            wide
            label="Stock Alert"
            border={withAlpha(colors.slate[200], 0.8)}
            tileBg={colors.danger[50]}
            tileFg={colors.danger[600]}
            tileRing={withAlpha(colors.danger[500], 0.1)}
            icon="inventory"
            value={tabCounts.out_of_stock ?? 0}
            unit={tabCounts.out_of_stock > 0 ? 'Restock' : 'Healthy'}
            unitPill={{ bg: colors.danger[50], fg: colors.danger[700] }}
            dot={tabCounts.out_of_stock > 0 ? colors.danger[500] : colors.success[500]}
            footer={tabCounts.out_of_stock > 0 ? 'Zero inventory' : 'All in stock'}
          />
        </View>

        {previewCount > 0 ? (
          <View style={styles.previewBanner}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
              <Icon name="pending" size={16} color={colors.warning[600]} style={{ marginTop: 2 }} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.bannerTitle}>
                  {`${previewCount} imported product${previewCount === 1 ? '' : 's'} waiting for your approval`}
                </Text>
                <Text style={styles.bannerText}>
                  They are Drafts and hidden from buyers. View, edit or delete any that are wrong, then approve to submit them for platform review.
                </Text>
              </View>
            </View>
            <View style={styles.bannerActions}>
              {list.tab !== 'preview' ? (
                <Pressable onPress={() => list.changeTab('preview')} style={({ pressed }) => [styles.reviewBtn, pressed && { backgroundColor: colors.warning[100] }]}>
                  <Text style={styles.reviewBtnText}>Review previews</Text>
                </Pressable>
              ) : null}
              <Pressable
                onPress={() => setApproveAllOpen(true)}
                disabled={approvePreviews.isPending}
                style={({ pressed }) => [styles.approveAll, shadows.sm, approvePreviews.isPending && { opacity: 0.5 }, pressed && { backgroundColor: colors.success[700] }]}
              >
                <Icon name="check" size={14} color="#fff" />
                <Text style={styles.approveAllText}>Approve all {previewCount}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* Smart Toolbar */}
        <View style={[styles.toolbar, shadows.xs]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            style={{ flexGrow: 0 }}
            contentContainerStyle={{ gap: 6, paddingBottom: 2 }}
          >
            {FILTER_TABS.map((tab) => {
              const isSelected = list.tab === tab.id
              return (
                <Pressable
                  key={tab.id}
                  onPress={() => list.changeTab(tab.id)}
                  style={[styles.tab, isSelected ? styles.tabOn : styles.tabOff]}
                >
                  <Text style={[styles.tabText, { color: isSelected ? '#fff' : colors.slate[600] }]}>{tab.label}</Text>
                  <View style={[styles.tabCount, { backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : colors.slate[200] }]}>
                    <Text noTranslate style={[styles.tabCountText, { color: isSelected ? '#fff' : colors.slate[700] }]}>
                      {tab.count}
                    </Text>
                  </View>
                </Pressable>
              )
            })}
          </ScrollView>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={[styles.search, searchFocused && styles.searchFocus]}>
              <Icon name="search" size={14} color={colors.slate[400]} />
              <TextInput
                value={searchValue}
                onChangeText={setSearch}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                placeholder="SKU, title or category…"
                placeholderTextColor={colors.slate[400]}
                autoCorrect={false}
                returnKeyType="search"
                style={styles.searchInput}
              />
              {searchValue ? (
                <Pressable onPress={() => setSearch('')} hitSlop={8} accessibilityLabel="Clear search">
                  <Icon name="close" size={12} color={colors.slate[400]} />
                </Pressable>
              ) : null}
            </View>

            <View style={styles.viewToggle}>
              {[
                { id: 'grid', icon: 'categories', label: 'Grid view' },
                { id: 'table', icon: 'list', label: 'Table view' },
              ].map((mode) => {
                const active = viewMode === mode.id
                return (
                  <Pressable
                    key={mode.id}
                    onPress={() => setViewMode(mode.id)}
                    accessibilityLabel={mode.label}
                    style={[styles.toggleBtn, active && [styles.toggleOn, shadows.xs]]}
                  >
                    <Icon name={mode.icon} size={14} color={active ? colors.brand[600] : colors.slate[500]} />
                  </Pressable>
                )
              })}
            </View>
          </View>
        </View>

        {/* Content Display */}
        {list.isLoading ? (
          <View style={[styles.stateBox, shadows.xs, { borderColor: colors.slate[200] }]}>
            <Text style={styles.loadingText}>Loading…</Text>
          </View>
        ) : list.error ? (
          <View style={[styles.stateBox, shadows.xs, { borderStyle: 'dashed', borderColor: colors.danger[200] }]}>
            <Text style={styles.errorTitle}>Could not load products</Text>
            <Pressable onPress={() => list.refetch()} style={({ pressed }) => [styles.outlineBtn, shadows.xs, { marginTop: 16 }, pressed && { backgroundColor: colors.slate[50] }]}>
              <Icon name="refresh" size={14} color={colors.slate[700]} />
              <Text style={styles.outlineBtnText}>Retry</Text>
            </Pressable>
          </View>
        ) : items.length === 0 ? (
          <View style={[styles.stateBox, shadows.xs, { borderStyle: 'dashed', borderColor: colors.slate[200] }]}>
            <View style={styles.emptyTile}>
              <Icon name="products" size={28} color={colors.slate[400]} />
            </View>
            <Text style={styles.emptyTitle}>{filtered ? 'No matching products' : 'No products yet'}</Text>
            <Text style={styles.emptyText}>
              {filtered
                ? 'Try adjusting your search query or switching your status tab.'
                : 'Add your first product to start selling once admin approves it.'}
            </Text>
            {filtered ? (
              <Pressable
                onPress={() => {
                  setSearch('')
                  list.changeTab('all')
                }}
                style={({ pressed }) => [styles.outlineBtn, shadows.xs, { marginTop: 16 }, pressed && { backgroundColor: colors.slate[50] }]}
              >
                <Icon name="close" size={12} color={colors.slate[700]} />
                <Text style={styles.outlineBtnText}>Clear Filters</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => setAddModalOpen(true)}
                style={({ pressed }) => [styles.addBtn, shadows.sm, { marginTop: 16 }, pressed && { backgroundColor: colors.brand[700] }]}
              >
                <Icon name="add" size={14} color="#fff" />
                <Text style={styles.addBtnText}>Add Product</Text>
              </Pressable>
            )}
          </View>
        ) : viewMode === 'grid' ? (
          <View style={{ gap: 8 }}>
            {cardRows.map((row, r) => (
              <View key={row[0].id} style={{ flexDirection: 'row', gap: 8, alignItems: 'stretch' }}>
                {row.map((item) => (
                  <View key={item.id} style={{ flex: 1, minWidth: 0 }}>
                    <ProductCard
                      item={item}
                      approving={approvePreviews.isPending}
                      onOpen={() => setEditingProduct(item)}
                      onView={() => setViewingProduct(item)}
                      onStock={() => setSelectedProduct(item)}
                      onApprove={() => approveImported({ productIds: [item.id] })}
                      onDeletePreview={() => setDeletingPreview(item)}
                    />
                  </View>
                ))}
                {row.length < 2 ? <View style={{ flex: 1 }} /> : null}
              </View>
            ))}
          </View>
        ) : (
          <View style={[styles.tableWrap, shadows.xs]}>
            <Table
              style={{ borderRadius: 0, borderWidth: 0 }}
              columns={tableColumnsWithActions}
              data={items}
              getRowKey={(item) => item.id}
              density="comfortable"
              onRowClick={(row) => setEditingProduct(row)}
            />
          </View>
        )}

        {items.length > 0 ? (
          <Pagination
            page={list.page}
            totalPages={list.totalPages}
            totalItems={list.totalItems}
            rowsPerPage={list.rowsPerPage}
            onPageChange={list.setPage}
            itemLabel="products"
          />
        ) : null}
      </PageBody>

      <AddVendorProductModal isOpen={addModalOpen} onClose={() => setAddModalOpen(false)} onAddProduct={list.addProduct} />

      <UpdateStockModal
        key={selectedProduct?.id}
        product={selectedProduct}
        isOpen={Boolean(selectedProduct)}
        onClose={() => setSelectedProduct(null)}
        onUpdateStock={list.updateStock}
      />

      <VendorProductDetailModal
        product={viewingProduct}
        isOpen={Boolean(viewingProduct)}
        onClose={() => setViewingProduct(null)}
        onEdit={(product) => {
          setViewingProduct(null)
          setEditingProduct(product)
        }}
        onUpdateStock={(product) => {
          setViewingProduct(null)
          setSelectedProduct(product)
        }}
      />

      <EditVendorProductModal
        key={editingProduct?.id}
        product={editingProduct}
        isOpen={Boolean(editingProduct)}
        onClose={() => setEditingProduct(null)}
        onEditProduct={list.editProduct}
      />

      <AdminImportModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        base={IMPORT_BASE.VENDOR}
        approveNote={APPROVE_NOTE}
        onFinished={() => list.refetch()}
        onShowPreviews={() => {
          list.refetch()
          list.changeTab('preview')
        }}
      />

      <ConfirmDialog
        isOpen={approveAllOpen}
        onClose={() => setApproveAllOpen(false)}
        title={`Approve all ${previewCount} imported products?`}
        description="They are submitted for platform review, like products you add by hand — live straight away only if auto-approval is on."
        confirmLabel="Approve all"
        isSubmitting={approvePreviews.isPending}
        onConfirm={async () => {
          await approveImported({ all: true })
          setApproveAllOpen(false)
        }}
      />

      <ConfirmDialog
        isOpen={Boolean(deletingPreview)}
        onClose={() => setDeletingPreview(null)}
        title="Delete this imported preview?"
        description={deletingPreview ? `"${deletingPreview.name}" is removed from your catalog. It was never live.` : ''}
        confirmLabel="Delete"
        tone="danger"
        onConfirm={async () => {
          await deletePreview(deletingPreview)
          setDeletingPreview(null)
        }}
      />

      {/* Scoped to this seller's own catalog server-side — see
          Controllers/vendorProductController.js — so a scan can never
          resolve to, or leak the existence of, another seller's product. */}
      <ScanBarcodeModal
        isOpen={scanOpen}
        onClose={() => setScanOpen(false)}
        lookupPath={(code) => `/vendor/products/barcode/${code}`}
        onFound={(product) => {
          setScanOpen(false)
          setViewingProduct(product)
        }}
      />
    </>
  )
}

const styles = StyleSheet.create({
  // header
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 16, lineHeight: 24, fontWeight: '700', letterSpacing: -0.4, color: colors.slate[900] },
  countPill: {
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: withAlpha(colors.slate[200], 0.7),
    backgroundColor: colors.slate[100],
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  countText: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.slate[600] },
  description: { marginTop: 2, fontSize: 12, lineHeight: 18, color: colors.ink.subtle },
  headerActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  headerBtn: { height: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: radius.lg, borderWidth: 1 },
  headerBtnSecondary: { paddingHorizontal: 10, borderColor: withAlpha(colors.slate[200], 0.9), backgroundColor: '#fff' },
  headerBtnPrimary: { paddingHorizontal: 12, borderColor: withAlpha(colors.brand[500], 0.2), backgroundColor: colors.brand[600] },
  headerBtnPrimaryText: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: '#fff' },

  // KPI
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kpiCell: { width: '48.5%', flexGrow: 1 },
  kpi: { borderRadius: radius.lg, borderWidth: 1, backgroundColor: '#fff', padding: 10 },
  kpiTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kpiLabel: { fontSize: 10, lineHeight: 15, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  kpiTile: { height: 28, width: 28, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, borderWidth: 1 },
  kpiValueRow: { marginTop: 6, flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  kpiValue: { fontSize: 20, lineHeight: 28, fontWeight: '800', letterSpacing: -0.5, color: colors.slate[900] },
  kpiUnit: { fontSize: 10, lineHeight: 15, fontWeight: '500', color: colors.slate[500] },
  kpiPill: { borderRadius: 9999, paddingHorizontal: 6, paddingVertical: 2 },
  kpiPillText: { fontSize: 10, lineHeight: 15, fontWeight: '600' },
  kpiFooter: { marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 4 },
  kpiDot: { height: 6, width: 6, borderRadius: 3 },
  kpiFooterText: { flexShrink: 1, fontSize: 10, lineHeight: 15, color: colors.slate[500] },

  // preview banner
  previewBanner: { gap: 12, borderRadius: radius['2xl'], borderWidth: 1, borderColor: colors.warning[200], backgroundColor: colors.warning[50], padding: 14 },
  bannerTitle: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: colors.warning[900] },
  bannerText: { fontSize: 12, lineHeight: 16, color: colors.warning[800] },
  bannerActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  reviewBtn: { borderRadius: radius.xl, borderWidth: 1, borderColor: colors.warning[300], backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 8 },
  reviewBtnText: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.warning[800] },
  approveAll: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.xl, backgroundColor: colors.success[600], paddingHorizontal: 14, paddingVertical: 8 },
  approveAllText: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: '#fff' },

  // toolbar
  toolbar: { gap: 10, borderRadius: radius.lg, borderWidth: 1, borderColor: withAlpha(colors.slate[200], 0.8), backgroundColor: '#fff', padding: 10 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.xl, paddingHorizontal: 10, paddingVertical: 6 },
  tabOn: { backgroundColor: colors.slate[900], ...shadows.xs },
  tabOff: { backgroundColor: colors.slate[50] },
  tabText: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
  tabCount: { borderRadius: 9999, paddingHorizontal: 6, paddingVertical: 1 },
  tabCountText: { fontSize: 10, lineHeight: 15, fontWeight: '700' },
  search: {
    flex: 1,
    height: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.slate[200],
    backgroundColor: withAlpha(colors.slate[50], 0.6),
    paddingHorizontal: 10,
  },
  searchFocus: { borderColor: colors.brand[500], backgroundColor: '#fff' },
  searchInput: { flex: 1, padding: 0, fontSize: 12, fontFamily: fontFamilyFor('500'), color: colors.slate[900] },
  viewToggle: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.xl, borderWidth: 1, borderColor: colors.slate[200], backgroundColor: withAlpha(colors.slate[100], 0.7), padding: 2 },
  toggleBtn: { height: 30, width: 30, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md },
  toggleOn: { backgroundColor: '#fff', borderWidth: 1, borderColor: withAlpha(colors.slate[200], 0.8) },

  // states
  stateBox: { alignItems: 'center', justifyContent: 'center', borderRadius: radius['2xl'], borderWidth: 1, backgroundColor: '#fff', paddingVertical: 64, paddingHorizontal: 16 },
  loadingText: { fontSize: 12, lineHeight: 16, color: colors.slate[500] },
  errorTitle: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: colors.danger[700] },
  emptyTile: { height: 56, width: 56, alignItems: 'center', justifyContent: 'center', borderRadius: radius['2xl'], borderWidth: 1, borderColor: colors.slate[200], backgroundColor: colors.slate[100], marginBottom: 14 },
  emptyTitle: { fontSize: 16, lineHeight: 24, fontWeight: '600', color: colors.slate[900], textAlign: 'center' },
  emptyText: { marginTop: 4, maxWidth: 384, fontSize: 12, lineHeight: 16, color: colors.slate[500], textAlign: 'center' },
  outlineBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.slate[200], backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 8 },
  outlineBtnText: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.slate[700] },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.xl, backgroundColor: colors.brand[600], paddingHorizontal: 16, paddingVertical: 8 },
  addBtnText: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: '#fff' },

  // table view
  tableWrap: { overflow: 'hidden', borderRadius: radius['2xl'], borderWidth: 1, borderColor: withAlpha(colors.slate[200], 0.9), backgroundColor: '#fff' },
  rowActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  rowIconBtn: { height: 32, width: 32, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md },

  // preview controls
  previewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: colors.warning[300],
    backgroundColor: colors.warning[50],
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  previewDot: { height: 6, width: 6, borderRadius: 3, backgroundColor: colors.warning[500] },
  previewBadgeText: { fontSize: 10, lineHeight: 15, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase', color: colors.warning[800] },
  approveBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radius.md, backgroundColor: colors.success[600], paddingHorizontal: 10, paddingVertical: 6 },
  approveText: { fontSize: 11, lineHeight: 16, fontWeight: '700', color: '#fff' },
  deletePreview: { height: 28, width: 28, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: withAlpha(colors.slate[200], 0.5) },

  // grid card
  card: { flex: 1, borderRadius: radius.lg, borderWidth: 1, borderColor: withAlpha(colors.slate[200], 0.9), backgroundColor: '#fff', padding: 10 },
  cover: {
    aspectRatio: 4 / 3,
    width: '100%',
    overflow: 'hidden',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.slate[100],
    backgroundColor: '#f6f8fb',
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsBox: { height: 40, width: 40, alignItems: 'center', justifyContent: 'center', borderRadius: radius.xl, borderWidth: 1, borderColor: withAlpha(colors.brand[500], 0.2), backgroundColor: withAlpha(colors.brand[500], 0.1) },
  initialsText: { fontSize: 14, lineHeight: 20, fontWeight: '700', color: colors.brand[600] },
  initialsFull: { fontSize: 14, lineHeight: 20, fontWeight: '700', color: colors.brand[600] },
  floatBadges: { position: 'absolute', top: 6, left: 6, maxWidth: '70%', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4, zIndex: 10 },
  floatPill: { flexDirection: 'row', alignItems: 'center', borderRadius: 9999, paddingHorizontal: 6, paddingVertical: 2 },
  floatPillText: { fontSize: 8, lineHeight: 12, fontWeight: '800', color: '#fff' },
  statusBadge: { position: 'absolute', top: 6, right: 6, zIndex: 10 },
  whiteBadge: { backgroundColor: 'rgba(255,255,255,0.95)', borderColor: 'rgba(255,255,255,0.8)' },
  activePill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 9999, borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.95)', paddingHorizontal: 6, paddingVertical: 2 },
  activeDot: { height: 6, width: 6, borderRadius: 3 },
  activeText: { fontSize: 9, lineHeight: 14, fontWeight: '700' },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  catChip: { maxWidth: 80, overflow: 'hidden', borderRadius: 4, backgroundColor: colors.brand[50], paddingHorizontal: 4, paddingVertical: 2, fontSize: 8, lineHeight: 12, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase', color: colors.brand[700] },
  brandText: { flexShrink: 1, fontSize: 9, lineHeight: 14, fontWeight: '500', color: colors.slate[500] },
  name: { marginTop: 4, minHeight: 29, fontSize: 12, lineHeight: 16.5, fontWeight: '700', color: colors.slate[900] },
  priceRow: { marginTop: 6, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: 4 },
  price: { fontSize: 14, lineHeight: 20, fontWeight: '900', letterSpacing: -0.3, color: colors.slate[900] },
  mrp: { fontSize: 10, lineHeight: 15, color: colors.slate[400], textDecorationLine: 'line-through' },
  stockRow: { marginTop: 6, paddingTop: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6, borderTopWidth: 1, borderTopColor: colors.slate[100] },
  stockDot: { height: 6, width: 6, borderRadius: 3 },
  stockText: { fontSize: 10, lineHeight: 15, fontWeight: '700' },
  sku: { maxWidth: 70, overflow: 'hidden', borderRadius: 4, borderWidth: 1, borderColor: withAlpha(colors.slate[200], 0.6), backgroundColor: colors.slate[50], paddingHorizontal: 4, paddingVertical: 2, fontFamily: 'monospace', fontSize: 9, lineHeight: 12, color: colors.slate[400] },
  rejection: { marginTop: 6, overflow: 'hidden', borderRadius: radius.md, borderWidth: 1, borderColor: withAlpha(colors.danger[200], 0.6), backgroundColor: withAlpha(colors.danger[50], 0.8), padding: 4, fontSize: 10, lineHeight: 15, color: colors.danger[600] },
  cardFooter: { marginTop: 8, paddingTop: 8, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 6, borderTopWidth: 1, borderTopColor: colors.slate[100] },
  liveDot: { height: 6, width: 6, borderRadius: 3 },
  liveText: { fontSize: 10, lineHeight: 15, fontWeight: '700', letterSpacing: -0.2 },
  cardActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  cardIconBtn: { height: 26, width: 26, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: withAlpha(colors.slate[200], 0.5) },
})
