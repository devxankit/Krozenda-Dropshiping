import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { Badge, Checkbox, Input, SegmentedControl, Text } from '../../../../components/ui'
import { FormDrawer } from '../../../../components/admin/forms'
import { useVendorProductsPickerController } from '../../controllers/useVendorController'
import { DateField } from './DateField'
import { colors, shadows } from '../../../../theme'

const DISCOUNT_TYPE_OPTIONS = [
  { id: 'PERCENTAGE', label: '% Percentage' },
  { id: 'FIXED', label: '₹ Flat amount' },
  { id: 'FREE_SHIPPING', label: 'Free shipping' },
]

function toDateInput(value) {
  if (!value) return ''
  const date = new Date(value)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// Same layout and interaction pattern as admin's CouponFormDrawer, scoped
// down to what a seller may actually set: no applicableTo picker (always
// PRODUCTS), no category/vendor targeting, and only their own products in
// the picker — see backend vendorCouponController.createMyCoupon.
export function VendorCouponFormDrawer({ isOpen, onClose, onSubmit, isSubmitting, error }) {
  const [form, setForm] = useState({
    code: '',
    description: '',
    discountType: 'PERCENTAGE',
    discountValue: '',
    maxDiscountAmount: '',
    minOrderAmount: '',
    usageLimit: '',
    perUserLimit: '',
    productIds: [],
    startDate: toDateInput(new Date()),
    endDate: '',
  })
  const [issue, setIssue] = useState(null)
  const { items: myProducts } = useVendorProductsPickerController(isOpen)

  function toggleProduct(id) {
    setForm((current) => ({
      ...current,
      productIds: current.productIds.includes(id) ? current.productIds.filter((v) => v !== id) : [...current.productIds, id],
    }))
  }

  function handleSubmit(event) {
    event.preventDefault()

    if (!form.code.trim()) return setIssue('Coupon code is required')
    if (form.discountType !== 'FREE_SHIPPING' && (!form.discountValue || Number(form.discountValue) <= 0)) {
      return setIssue('Enter a valid discount value')
    }
    if (!form.startDate || !form.endDate) return setIssue('Start and end dates are required')
    if (new Date(form.endDate) <= new Date(form.startDate)) return setIssue('End date must be after start date')
    if (form.productIds.length === 0) return setIssue('Select at least one of your products')
    setIssue(null)

    onSubmit({
      code: form.code.trim().toUpperCase(),
      description: form.description.trim(),
      discountType: form.discountType,
      discountValue: form.discountType === 'FREE_SHIPPING' ? 0 : Number(form.discountValue),
      maxDiscountAmount: form.maxDiscountAmount ? Number(form.maxDiscountAmount) : null,
      minOrderAmount: form.minOrderAmount ? Number(form.minOrderAmount) : 0,
      usageLimit: form.usageLimit ? Number(form.usageLimit) : null,
      perUserLimit: form.perUserLimit ? Number(form.perUserLimit) : null,
      productIds: form.productIds,
      startDate: form.startDate,
      endDate: form.endDate,
    })
  }

  return (
    <FormDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="New coupon"
      description="Discount rules and dates — applies only to the products you pick below."
      submitLabel="Create coupon"
      isSubmitting={isSubmitting}
      error={issue ? { message: issue } : error}
      onSubmit={handleSubmit}
      width="lg"
    >
      <View style={{ gap: 16 }}>
        <Input
          label="Coupon Code"
          required
          placeholder="e.g. SAVE20"
          autoCapitalize="characters"
          autoCorrect={false}
          value={form.code}
          onChange={(event) => setForm((c) => ({ ...c, code: event.target.value.toUpperCase() }))}
        />
        <Input
          label="Description (optional)"
          placeholder="Shown to buyers at checkout"
          value={form.description}
          onChange={(event) => setForm((c) => ({ ...c, description: event.target.value }))}
        />
      </View>

      <View style={{ gap: 12 }}>
        <View style={styles.typeRow}>
          <Text style={styles.label}>Discount Type</Text>
          <View style={{ flexShrink: 1 }}>
            <SegmentedControl items={DISCOUNT_TYPE_OPTIONS} activeId={form.discountType} onChange={(id) => setForm((c) => ({ ...c, discountType: id }))} />
          </View>
        </View>
        {form.discountType !== 'FREE_SHIPPING' ? (
          <View style={{ gap: 16 }}>
            <Input
              label={form.discountType === 'FIXED' ? 'Discount Amount (₹)' : 'Discount %'}
              type="number"
              required
              value={form.discountValue}
              onChange={(event) => setForm((c) => ({ ...c, discountValue: event.target.value }))}
            />
            <Input
              label="Max Discount Cap (₹, optional)"
              type="number"
              value={form.maxDiscountAmount}
              onChange={(event) => setForm((c) => ({ ...c, maxDiscountAmount: event.target.value }))}
            />
          </View>
        ) : null}
      </View>

      <View style={{ gap: 16 }}>
        <Input
          label="Minimum Order (₹, optional)"
          type="number"
          value={form.minOrderAmount}
          onChange={(event) => setForm((c) => ({ ...c, minOrderAmount: event.target.value }))}
        />
        <Input
          label="Total Usage Limit (optional)"
          type="number"
          keyboardType="number-pad"
          value={form.usageLimit}
          onChange={(event) => setForm((c) => ({ ...c, usageLimit: event.target.value }))}
        />
        <Input
          label="Per-Customer Limit (optional)"
          type="number"
          keyboardType="number-pad"
          value={form.perUserLimit}
          onChange={(event) => setForm((c) => ({ ...c, perUserLimit: event.target.value }))}
        />
      </View>

      <View style={{ gap: 16 }}>
        <DateField label="Start Date" required value={form.startDate} onChange={(event) => setForm((c) => ({ ...c, startDate: event.target.value }))} />
        <DateField label="End Date" required value={form.endDate} onChange={(event) => setForm((c) => ({ ...c, endDate: event.target.value }))} />
      </View>

      <View style={{ gap: 8 }}>
        <Text style={styles.label}>Applies To (your products)</Text>
        <ScrollView style={styles.picker} nestedScrollEnabled keyboardShouldPersistTaps="handled">
          {myProducts.length === 0 ? <Text style={styles.pickerEmpty}>No active products found.</Text> : null}
          {myProducts.map((p) => (
            <Pressable key={p.id} onPress={() => toggleProduct(p.id)} accessibilityRole="checkbox" accessibilityState={{ checked: form.productIds.includes(p.id) }} style={styles.pickerRow}>
              <View pointerEvents="none">
                <Checkbox checked={form.productIds.includes(p.id)} />
              </View>
              <Text noTranslate numberOfLines={1} style={styles.pickerName}>
                {p.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <View style={styles.previewWrap}>
        <Text style={[styles.label, { color: colors.slate[400] }]}>Live Preview</Text>
        <View style={[styles.previewCard, shadows.xs]}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text noTranslate={Boolean(form.code)} style={styles.previewCode}>
              {form.code || 'COUPON CODE'}
            </Text>
            <Text style={styles.previewDesc}>{form.description || 'No description'}</Text>
          </View>
          <Badge tone="success" dot size="sm">
            Active
          </Badge>
        </View>
      </View>
    </FormDrawer>
  )
}

const styles = StyleSheet.create({
  label: { fontSize: 11, lineHeight: 16, fontWeight: '700', letterSpacing: 0.55, textTransform: 'uppercase', color: colors.slate[500] },
  typeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  picker: { maxHeight: 192, borderRadius: 12, borderWidth: 1, borderColor: colors.slate[200], padding: 8 },
  pickerEmpty: { padding: 8, fontSize: 11, lineHeight: 16, color: colors.slate[400] },
  pickerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6 },
  pickerName: { flex: 1, fontSize: 12, lineHeight: 16, color: colors.slate[900] },
  previewWrap: {
    marginTop: 8,
    gap: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.8)',
    backgroundColor: 'rgba(248,250,252,0.6)',
    padding: 16,
  },
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.slate[200],
    backgroundColor: '#fff',
    padding: 14,
  },
  previewCode: { fontFamily: 'monospace', fontSize: 14, lineHeight: 20, fontWeight: '700', color: colors.slate[900] },
  previewDesc: { fontSize: 11, lineHeight: 16, color: colors.slate[500] },
})
