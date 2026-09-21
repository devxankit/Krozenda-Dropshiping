import { useState } from 'react'
import { Badge, Checkbox, Input, SegmentedControl } from '../../../../components/ui'
import { FormDrawer } from '../forms'

const DISCOUNT_TYPE_OPTIONS = [
  { id: 'PERCENTAGE', label: '% Percentage' },
  { id: 'FIXED', label: '₹ Flat amount' },
]

function toDateInput(value) {
  if (!value) return ''
  return new Date(value).toISOString().slice(0, 10)
}

// Paise-to-rupee on the way in for FIXED discounts / min order amount — the
// list this edits is serialized in paise (see couponController.serializeCoupon)
// but the create/update endpoints take plain rupees, matching every other
// write in this codebase.
export function CouponFormDrawer({ isOpen, onClose, coupon, writer }) {
  const editing = Boolean(coupon)
  const [form, setForm] = useState(() => ({
    code: coupon?.code ?? '',
    description: coupon?.description ?? '',
    discountType: coupon?.discountType ?? 'PERCENTAGE',
    discountValue: coupon ? String(coupon.discountType === 'FIXED' ? coupon.discountValue / 100 : coupon.discountValue) : '',
    maxDiscountAmount: coupon?.maxDiscountAmount != null ? String(coupon.maxDiscountAmount / 100) : '',
    minOrderAmount: coupon?.minOrderAmount ? String(coupon.minOrderAmount / 100) : '',
    usageLimit: coupon?.usageLimit != null ? String(coupon.usageLimit) : '',
    perUserLimit: coupon?.perUserLimit != null ? String(coupon.perUserLimit) : '',
    startDate: toDateInput(coupon?.startDate) || toDateInput(new Date()),
    endDate: toDateInput(coupon?.endDate),
    isActive: coupon?.isActive ?? true,
  }))
  const [issue, setIssue] = useState(null)

  const mutation = editing ? writer.update : writer.create

  function handleSubmit(event) {
    event.preventDefault()

    if (!form.code.trim()) return setIssue('Coupon code is required')
    if (!form.discountValue || Number(form.discountValue) <= 0) {
      return setIssue('Enter a valid discount value')
    }
    if (!form.startDate || !form.endDate) return setIssue('Start and end dates are required')
    if (new Date(form.endDate) <= new Date(form.startDate)) return setIssue('End date must be after start date')
    setIssue(null)

    const payload = {
      code: form.code.trim().toUpperCase(),
      description: form.description.trim(),
      discountType: form.discountType,
      discountValue: Number(form.discountValue),
      maxDiscountAmount: form.maxDiscountAmount ? Number(form.maxDiscountAmount) : null,
      minOrderAmount: form.minOrderAmount ? Number(form.minOrderAmount) : 0,
      usageLimit: form.usageLimit ? Number(form.usageLimit) : null,
      perUserLimit: form.perUserLimit ? Number(form.perUserLimit) : null,
      applicableTo: 'ALL',
      productIds: [],
      categoryIds: [],
      vendorIds: [],
      customerEligibility: 'ALL',
      startDate: form.startDate,
      endDate: form.endDate,
      isActive: form.isActive,
    }

    mutation.run(editing ? { id: coupon.id, ...payload } : payload)
  }

  return (
    <FormDrawer
      isOpen={isOpen}
      onClose={onClose}
      title={editing ? `Edit coupon: ${coupon.code}` : 'New coupon'}
      description="Discount rules, eligible scope, dates and usage limits."
      submitLabel={editing ? 'Save changes' : 'Create coupon'}
      isSubmitting={mutation.isSubmitting}
      error={issue ? { message: issue } : mutation.error}
      onSubmit={handleSubmit}
      width="lg"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          id="coupon-code"
          label="Coupon Code"
          required
          placeholder="e.g. WELCOME20"
          value={form.code}
          onChange={(event) => setForm((c) => ({ ...c, code: event.target.value.toUpperCase() }))}
        />
        <Input
          id="coupon-description"
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            id="coupon-discount-value"
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
            id="coupon-max-discount"
            label="Max Discount Cap (₹, optional)"
            type="number"
            min="0"
            step="0.01"
            value={form.maxDiscountAmount}
            onChange={(event) => setForm((c) => ({ ...c, maxDiscountAmount: event.target.value }))}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Input
          id="coupon-min-order"
          label="Minimum Order (₹, optional)"
          type="number"
          min="0"
          step="0.01"
          value={form.minOrderAmount}
          onChange={(event) => setForm((c) => ({ ...c, minOrderAmount: event.target.value }))}
        />
        <Input
          id="coupon-usage-limit"
          label="Total Usage Limit (optional)"
          type="number"
          min="1"
          value={form.usageLimit}
          onChange={(event) => setForm((c) => ({ ...c, usageLimit: event.target.value }))}
        />
        <Input
          id="coupon-per-user-limit"
          label="Per-Customer Limit (optional)"
          type="number"
          min="1"
          value={form.perUserLimit}
          onChange={(event) => setForm((c) => ({ ...c, perUserLimit: event.target.value }))}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          id="coupon-start-date"
          label="Start Date"
          type="date"
          required
          value={form.startDate}
          onChange={(event) => setForm((c) => ({ ...c, startDate: event.target.value }))}
        />
        <Input
          id="coupon-end-date"
          label="End Date"
          type="date"
          required
          value={form.endDate}
          onChange={(event) => setForm((c) => ({ ...c, endDate: event.target.value }))}
        />
      </div>

      <Checkbox
        id="coupon-active"
        label="Active"
        description="Inactive coupons never validate at checkout, regardless of dates."
        checked={form.isActive}
        onChange={(event) => setForm((c) => ({ ...c, isActive: event.target.checked }))}
      />

      <div className="mt-2 flex flex-col gap-2 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4">
        <span className="text-2xs font-bold uppercase tracking-wider text-slate-400">Live Preview</span>
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
          <div>
            <p className="font-mono font-bold text-slate-900 text-sm">{form.code || 'COUPON CODE'}</p>
            <p className="text-2xs text-slate-500">{form.description || 'No description'}</p>
          </div>
          <Badge tone={form.isActive ? 'success' : 'neutral'} dot size="sm">
            {form.isActive ? 'Active' : 'Inactive'}
          </Badge>
        </div>
      </div>
    </FormDrawer>
  )
}
