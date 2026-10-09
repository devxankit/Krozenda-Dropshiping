import { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native'
import { Icon } from '../../../../components/ui/Icon'
import { Sheet } from '../../../../components/ui/Sheet'
import { Text } from '../../../../components/ui/Text'
import { useT } from '../../../../lib/i18n'
import { colors, fontFamilyFor, radius } from '../../../../theme'
import { useCatalogSettingsController } from '../../controllers/useProductsController'

// Filter panel shown inside the browse screen's bottom sheet.
//
// It holds DRAFT state and only lifts it on "Apply": applying on every checkbox tick fired one API
// request per click, so selecting four brands cost four round trips.

const RATING_OPTIONS = [
  { label: '4★ & above', value: 4 },
  { label: '3★ & above', value: 3 },
  { label: '2★ & above', value: 2 },
]

const DISCOUNT_OPTIONS = [
  { label: '70% or more', value: 70 },
  { label: '50% or more', value: 50 },
  { label: '40% or more', value: 40 },
  { label: '30% or more', value: 30 },
  { label: '20% or more', value: 20 },
  { label: '10% or more', value: 10 },
]

// One-tap price bands. They only fill the Min/Max inputs, so the range can still be fine-tuned by
// hand afterwards.
const PRICE_PRESETS = [
  { label: 'Under ₹500', min: null, max: 500 },
  { label: '₹500 – ₹1,000', min: 500, max: 1000 },
  { label: '₹1,000 – ₹5,000', min: 1000, max: 5000 },
  { label: '₹5,000 – ₹20,000', min: 5000, max: 20000 },
  { label: 'Over ₹20,000', min: 20000, max: null },
]

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'popular', label: 'Popularity' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'discount', label: 'Discount' },
  { value: 'rating', label: 'Customer rating' },
]

const SOURCE_OPTIONS = [
  { label: 'All products', value: 'all' },
  { label: 'Dropship only', value: 'dropship' },
  { label: 'Regular stock only', value: 'normal' },
]

const PRICE_CEILING = 200000

function Chip({ active, label, onPress, noTranslate = false }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityState={{ selected: active }}
      style={[styles.chip, active ? styles.chipActive : styles.chipIdle]}
    >
      <Text noTranslate={noTranslate} style={[styles.chipText, { color: active ? '#fff' : colors.slate[600] }]}>
        {label}
      </Text>
    </Pressable>
  )
}

function Legend({ children }) {
  return <Text style={styles.legend}>{children}</Text>
}

export function CatalogFilterPanel({
  params,
  brands,
  categories,
  onApply,
  onClear,
  onClose,
  showCategories = true,
  showSort = false,
}) {
  const t = useT()
  const [brandQuery, setBrandQuery] = useState('')
  // "Product type" (dropship vs regular stock) is only shown while dropshipping is enabled
  // platform-wide (Admin > CJ Dropshipping > Settings).
  const { dropshippingEnabled } = useCatalogSettingsController()

  const applied = useMemo(
    () => ({
      category: params.category,
      brands: params.brands,
      minPrice: params.minPrice,
      maxPrice: params.maxPrice,
      rating: params.rating,
      inStock: params.inStock,
      minDiscount: params.minDiscount,
      source: params.source,
      flashSale: params.flashSale,
      trending: params.trending,
      sort: params.sort,
    }),
    [params],
  )

  // A stable signature of what is currently applied, so the draft can be re-synced when the route
  // params change underneath us (back, a link, or "Clear all" from the results header).
  const appliedSignature = JSON.stringify(applied)

  // Render-phase adjustment rather than an effect, so the panel never paints one frame of stale
  // selections.
  const [draft, setDraft] = useState(applied)
  const [draftSignature, setDraftSignature] = useState(appliedSignature)
  if (draftSignature !== appliedSignature) {
    setDraftSignature(appliedSignature)
    setDraft(applied)
  }

  const patch = (next) => setDraft((prev) => ({ ...prev, ...next }))

  const toggleBrand = (brandId) =>
    patch({
      brands: draft.brands.includes(brandId)
        ? draft.brands.filter((b) => b !== brandId)
        : [...draft.brands, brandId],
    })

  const filteredBrands = brands.filter((b) => b.name.toLowerCase().includes(brandQuery.trim().toLowerCase()))

  // min > max is a range that can match nothing.
  const priceRangeInvalid = draft.minPrice != null && draft.maxPrice != null && draft.minPrice > draft.maxPrice

  const handleApply = () => {
    if (priceRangeInvalid) return
    onApply(draft)
    onClose?.()
  }

  const priceInput = (value, key, placeholder) => (
    <TextInput
      keyboardType="number-pad"
      value={value == null ? '' : String(value)}
      onChangeText={(text) => {
        const digits = text.replace(/\D/g, '')
        patch({ [key]: digits === '' ? null : Math.min(PRICE_CEILING, Math.max(0, Number(digits))) })
      }}
      placeholder={placeholder}
      placeholderTextColor={colors.slate[400]}
      accessibilityLabel={key === 'minPrice' ? 'Minimum price' : 'Maximum price'}
      style={styles.priceInput}
    />
  )

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {showSort ? (
          <View style={styles.group}>
            <Legend>Sort by</Legend>
            <View style={styles.chips}>
              {SORT_OPTIONS.map((option) => (
                <Chip
                  key={option.value}
                  label={option.label}
                  active={draft.sort === option.value}
                  onPress={() => patch({ sort: option.value })}
                />
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.group}>
          <Legend>Offers</Legend>
          <View style={styles.chips}>
            <Chip label="Flash sale" active={draft.flashSale} onPress={() => patch({ flashSale: !draft.flashSale })} />
            <Chip label="Trending" active={draft.trending} onPress={() => patch({ trending: !draft.trending })} />
            <Chip label="In stock only" active={draft.inStock} onPress={() => patch({ inStock: !draft.inStock })} />
          </View>
        </View>

        {showCategories && categories.length > 0 ? (
          <View style={styles.group}>
            <Legend>Category</Legend>
            <View style={{ gap: 4 }}>
              <Pressable
                onPress={() => patch({ category: '' })}
                style={[styles.catRow, !draft.category && { backgroundColor: colors.blue[50] }]}
              >
                <Text style={[styles.catText, { color: !draft.category ? colors.blue[700] : colors.slate[700] }]}>
                  All categories
                </Text>
                {!draft.category ? <Icon name="HiCheck" size={16} color={colors.blue[700]} /> : null}
              </Pressable>
              {categories.map((category) => {
                const selected = draft.category === category.id
                return (
                  <Pressable
                    key={category.id}
                    onPress={() => patch({ category: category.id })}
                    style={[styles.catRow, selected && { backgroundColor: colors.blue[50] }]}
                  >
                    <Text
                      noTranslate
                      numberOfLines={1}
                      style={[styles.catText, { flex: 1, color: selected ? colors.blue[700] : colors.slate[700] }]}
                    >
                      {category.name}
                    </Text>
                    {selected ? <Icon name="HiCheck" size={16} color={colors.blue[700]} /> : null}
                  </Pressable>
                )
              })}
            </View>
          </View>
        ) : null}

        {brands.length > 0 ? (
          <View style={styles.group}>
            <Legend>Brand</Legend>
            <View style={styles.brandSearch}>
              <Icon name="HiMagnifyingGlass" size={16} color={colors.slate[400]} />
              <TextInput
                value={brandQuery}
                onChangeText={setBrandQuery}
                placeholder={t('Search brands')}
                placeholderTextColor={colors.slate[400]}
                accessibilityLabel="Search brands"
                style={styles.brandSearchInput}
              />
            </View>
            {/* Capped height with its own scroll, so a long brand list does not push the rest of
                the panel out of reach. */}
            <ScrollView nestedScrollEnabled style={{ maxHeight: 208 }} showsVerticalScrollIndicator={false}>
              {filteredBrands.length === 0 ? (
                <Text style={styles.noBrands}>{`No brands match “${brandQuery}”.`}</Text>
              ) : (
                filteredBrands.map((brand) => {
                  const checked = draft.brands.includes(brand.id)
                  return (
                    <Pressable
                      key={brand.id}
                      onPress={() => toggleBrand(brand.id)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked }}
                      style={styles.brandRow}
                    >
                      <View style={[styles.checkbox, checked && styles.checkboxOn]}>
                        {checked ? <Icon name="HiCheck" size={12} color="#fff" /> : null}
                      </View>
                      <Text noTranslate numberOfLines={1} style={styles.brandName}>
                        {brand.name}
                      </Text>
                    </Pressable>
                  )
                })
              )}
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.group}>
          <Legend>Price</Legend>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {priceInput(draft.minPrice, 'minPrice', t('Min'))}
            <Text style={{ fontSize: 12, color: colors.slate[400] }}>to</Text>
            {priceInput(draft.maxPrice, 'maxPrice', t('Max'))}
          </View>
          <View style={styles.chips}>
            {PRICE_PRESETS.map((preset) => {
              const active = draft.minPrice === preset.min && draft.maxPrice === preset.max
              return (
                <Chip
                  key={preset.label}
                  label={preset.label}
                  active={active}
                  onPress={() =>
                    patch(active ? { minPrice: null, maxPrice: null } : { minPrice: preset.min, maxPrice: preset.max })
                  }
                />
              )
            })}
          </View>
          {priceRangeInvalid ? (
            <Text accessibilityRole="alert" style={styles.priceError}>
              Minimum price cannot be higher than the maximum.
            </Text>
          ) : null}
        </View>

        <View style={styles.group}>
          <Legend>Customer rating</Legend>
          <View style={styles.chips}>
            {RATING_OPTIONS.map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                active={draft.rating === option.value}
                onPress={() => patch({ rating: draft.rating === option.value ? null : option.value })}
              />
            ))}
          </View>
        </View>

        <View style={styles.group}>
          <Legend>Discount</Legend>
          <View style={styles.chips}>
            {DISCOUNT_OPTIONS.map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                active={draft.minDiscount === option.value}
                onPress={() => patch({ minDiscount: draft.minDiscount === option.value ? null : option.value })}
              />
            ))}
          </View>
        </View>

        {dropshippingEnabled ? (
          <View style={styles.group}>
            <Legend>Product type</Legend>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {SOURCE_OPTIONS.map((option) => (
                <Chip
                  key={option.value}
                  label={option.label}
                  active={draft.source === option.value}
                  onPress={() => patch({ source: option.value })}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.actions}>
        <Pressable
          onPress={() => {
            onClear()
            onClose?.()
          }}
          style={({ pressed }) => [styles.clearBtn, pressed && { backgroundColor: colors.slate[50] }]}
        >
          <Text style={[styles.actionText, { color: colors.slate[700] }]}>Clear all</Text>
        </Pressable>
        <Pressable
          onPress={handleApply}
          disabled={priceRangeInvalid}
          style={({ pressed }) => [
            styles.applyBtn,
            pressed && { backgroundColor: colors.blue[700] },
            priceRangeInvalid && { opacity: 0.5 },
          ]}
        >
          <Text style={[styles.actionText, { color: '#fff' }]}>Apply filters</Text>
        </Pressable>
      </View>
    </View>
  )
}

// Mobile bottom sheet wrapper (Android back and the backdrop close it).
export function FilterSheet({ open, onClose, children, title = 'Filters' }) {
  return (
    <Sheet visible={open} onClose={onClose} maxHeight="85%" style={{ height: '85%' }}>
      <View style={styles.sheetHeader}>
        <Text style={styles.sheetTitle}>{title}</Text>
        <Pressable
          onPress={onClose}
          accessibilityLabel="Close filters"
          style={({ pressed }) => [styles.closeBtn, pressed && { backgroundColor: colors.slate[100] }]}
        >
          <Icon name="HiXMark" size={20} color={colors.slate[500]} />
        </Pressable>
      </View>
      {children}
    </Sheet>
  )
}

const styles = StyleSheet.create({
  body: { padding: 16, gap: 20 },
  group: { gap: 8 },
  legend: { fontSize: 12, lineHeight: 16, fontWeight: '800', letterSpacing: 0.3, color: colors.slate[500], textTransform: 'uppercase' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 9999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6 },
  chipActive: { borderColor: colors.blue[600], backgroundColor: colors.blue[600] },
  chipIdle: { borderColor: colors.slate[200], backgroundColor: '#fff' },
  chipText: { fontSize: 11, lineHeight: 16, fontWeight: '700' },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.xl,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  catText: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
  brandSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.slate[200],
    backgroundColor: colors.slate[50],
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  brandSearchInput: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 0,
    fontSize: 12,
    fontFamily: fontFamilyFor('600'),
    color: colors.slate[900],
  },
  noBrands: { paddingHorizontal: 4, paddingVertical: 8, fontSize: 12, lineHeight: 16, color: colors.slate[400] },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: radius.lg, paddingHorizontal: 4, paddingVertical: 8 },
  checkbox: {
    height: 16,
    width: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.slate[300],
    backgroundColor: '#fff',
  },
  checkboxOn: { borderColor: colors.blue[600], backgroundColor: colors.blue[600] },
  brandName: { flex: 1, fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.slate[700] },
  priceInput: {
    flex: 1,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.slate[200],
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12,
    fontFamily: fontFamilyFor('600'),
    color: colors.slate[900],
  },
  priceError: { fontSize: 11, lineHeight: 16, fontWeight: '600', color: colors.red[600] },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.slate[200],
    backgroundColor: '#fff',
    padding: 12,
  },
  clearBtn: {
    flex: 1,
    alignItems: 'center',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.slate[200],
    paddingVertical: 12,
  },
  applyBtn: { flex: 1, alignItems: 'center', borderRadius: radius.xl, backgroundColor: colors.blue[600], paddingVertical: 12 },
  actionText: { fontSize: 12, lineHeight: 16, fontWeight: '700' },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sheetTitle: { fontSize: 14, lineHeight: 20, fontWeight: '800', color: colors.slate[900] },
  closeBtn: { height: 36, width: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 9999 },
})
