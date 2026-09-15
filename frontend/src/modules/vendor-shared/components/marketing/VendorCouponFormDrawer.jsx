import { useState } from 'react'
import { Badge, Checkbox, Input, SegmentedControl } from '../../../../components/ui'
import { FormDrawer } from '../../../admin/components/forms'
import { useVendorProductsPickerController } from '../../controllers/useVendorController'

const DISCOUNT_TYPE_OPTIONS = [
  { id: 'PERCENTAGE', label: '% Percentage' },
  { id: 'FIXED', label: '₹ Flat amount' },
  { id: 'FREE_SHIPPING', label: 'Free shipping' },
]

function toDateInput(value) {
  if (!value) return ''
  return new Date(value).toISOString().slice(0, 10)
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          id="vendor-coupon-code"
          label="Coupon Code"
          required
          placeholder="e.g. SAVE20"
          value={form.code}
          onChange={(event) => setForm((c) => ({ ...c, code: event.target.value.toUpperCase() }))}
        />
        <Input
          id="vendor-coupon-description"
          label="Description (optional)"
          placeholder="Shown to buyers at checkout"
          value={form.description}
          onChange={(event) => setForm((c) => ({ ...c, description: event.target.value }))}
        />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <label className="text-2xs font-bold uppercase tracking-wider text-slate-500">Discount Type</label>
          <SegmentedControl items={DISCOUNT_TYPE_OPTIONS} activeId={form.discountType} onChange={(id) => setForm((c) => ({ ...c, discountType: id }))} />
        </div>
        {form.discountType !== 'FREE_SHIPPING' && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              id="vendor-coupon-discount-value"
              label={form.discountType === 'FIXED' ? 'Discount Amount (₹)' : 'Discount %'}
              type="number"
              min="0"
              max={form.discountType === 'PERCENTAGE' ? 100 : undefined}
              step="0.01"
              required
              value={form.discountValue}
              onChange={(event) => setForm((c) => ({ ...c, discountValue: event.target.value }))}
            />
            <Input
              id="vendor-coupon-max-discount"
              label="Max Discount Cap (₹, optional)"
              type="number"
              min="0"
              step="0.01"
              value={form.maxDiscountAmount}
              onChange={(event) => setForm((c) => ({ ...c, maxDiscountAmount: event.target.value }))}
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Input
          id="vendor-coupon-min-order"
          label="Minimum Order (₹, optional)"
          type="number"
          min="0"
          step="0.01"
          value={form.minOrderAmount}
          onChange={(event) => setForm((c) => ({ ...c, minOrderAmount: event.target.value }))}
        />
        <Input
          id="vendor-coupon-usage-limit"
          label="Total Usage Limit (optional)"
          type="number"
          min="1"
          value={form.usageLimit}
          onChange={(event) => setForm((c) => ({ ...c, usageLimit: event.target.value }))}
        />
        <Input
          id="vendor-coupon-per-user-limit"
          label="Per-Customer Limit (optional)"
          type="number"
          min="1"
          value={form.perUserLimit}
          onChange={(event) => setForm((c) => ({ ...c, perUserLimit: event.target.value }))}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          id="vendor-coupon-start-date"
          label="Start Date"
          type="date"
          required
          value={form.startDate}
          onChange={(event) => setForm((c) => ({ ...c, startDate: event.target.value }))}
        />
        <Input
          id="vendor-coupon-end-date"
          label="End Date"
          type="date"
          required
          value={form.endDate}
          onChange={(event) => setForm((c) => ({ ...c, endDate: event.target.value }))}
        />
      </div>

      <div>
        <label className="text-2xs font-bold uppercase tracking-wider text-slate-500">Applies To (your products)</label>
        <div className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-slate-200 p-2">
          {myProducts.length === 0 && <p className="p-2 text-2xs text-slate-400">No active products found.</p>}
          {myProducts.map((p) => (
            <label key={p.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-slate-50">
              <Checkbox checked={form.productIds.includes(p.id)} onChange={() => toggleProduct(p.id)} />
              <span className="truncate">{p.name}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="mt-2 flex flex-col gap-2 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4">
        <span className="text-2xs font-bold uppercase tracking-wider text-slate-400">Live Preview</span>
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
          <div>
            <p className="font-mono font-bold text-slate-900 text-sm">{form.code || 'COUPON CODE'}</p>
            <p className="text-2xs text-slate-500">{form.description || 'No description'}</p>
          </div>
          <Badge tone="success" dot size="sm">Active</Badge>
        </div>
      </div>
    </FormDrawer>
  )
}
