import { useState } from 'react'
import { Avatar, Button, Icon, Input, Select, Textarea } from '../../../../components/ui'
import { FormDrawer } from '../forms'
import { ConfirmDialog } from '../overlay/ConfirmDialog'
import {
  attributeWriteSchema,
  brandWriteSchema,
  categoryWriteSchema,
  inventoryAdjustSchema,
} from '../../schemas/catalogSchema'

const DEPTH_OPTIONS = [
  { value: '0', label: 'Top-level root category' },
  { value: '1', label: 'Sub-category (child)' },
]

const CATEGORY_STATUS_OPTIONS = [
  { value: 'live', label: 'Live (Active in storefront)' },
  { value: 'pending', label: 'Pending review' },
  { value: 'draft', label: 'Draft (Hidden)' },
]

const BRAND_STATUS_OPTIONS = [
  { value: 'live', label: 'Live (Approved & active)' },
  { value: 'pending', label: 'Pending approval' },
  { value: 'changes', label: 'Needs changes' },
  { value: 'rejected', label: 'Rejected' },
]

const BRAND_OWNER_OPTIONS = [
  { value: 'In-house', label: 'In-house (Krozenda Flagship)' },
  { value: 'Vendor partner', label: 'Vendor partner brand' },
  { value: 'Third-party Verified', label: 'Third-party verified' },
]

export function CategoryFormDrawer({
  isOpen,
  onClose,
  category,
  parentCategories = [],
  defaultParentId = null,
  writer,
}) {
  const editing = Boolean(category)
  const [imageFile, setImageFile] = useState(null)
  const [form, setForm] = useState(() => ({
    name: category?.name ?? '',
    depth: String(category?.depth ?? (defaultParentId ? 1 : 0)),
    parent: category?.parentId ?? category?.parent ?? defaultParentId ?? '',
    commissionRate: category?.commissionRate == null ? '' : String(category.commissionRate),
    description: category?.description ?? '',
    status: category?.status ?? 'live',
  }))
  const [issue, setIssue] = useState(null)

  const mutation = editing ? writer.update : writer.create

  function handleSubmit(event) {
    event.preventDefault()
    const isSub = form.depth === '1'
    const parentVal = isSub && form.parent ? form.parent : null

    if (isSub && !parentVal && parentCategories.length > 0) {
      setIssue('Please select a parent category for this sub-category')
      return
    }

    const payload = {
      name: form.name.trim(),
      depth: isSub ? 1 : 0,
      parent: parentVal,
      commissionRate: form.commissionRate === '' ? null : Number(form.commissionRate),
      description: form.description ? form.description.trim() : '',
      status: form.status,
    }

    const result = categoryWriteSchema.safeParse(payload)
    if (!result.success) {
      setIssue(result.error.issues[0]?.message || 'Validation error')
      return
    }
    setIssue(null)

    if (imageFile) {
      payload.image = imageFile
    }

    mutation.run(editing ? { id: category.id, ...payload } : payload)
  }

  const previewSrc = imageFile ? URL.createObjectURL(imageFile) : category?.image || undefined

  const parentOptions = [
    { value: '', label: 'Select parent category...' },
    ...parentCategories.map((p) => ({ value: p.id, label: p.name })),
  ]

  return (
    <FormDrawer
      isOpen={isOpen}
      onClose={onClose}
      title={editing ? `Edit ${category.name}` : 'Create category'}
      description="Define category hierarchy, icon/thumbnail, and commission rate inheritance."
      submitLabel={editing ? 'Save changes' : 'Create category'}
      isSubmitting={mutation.isSubmitting}
      error={issue ? { message: issue } : mutation.error}
      onSubmit={handleSubmit}
      width="lg"
    >
      {/* Category Image */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
          Category Thumbnail / Icon
        </label>
        <div className="flex items-center gap-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-3.5 transition-colors hover:border-brand-300">
          <Avatar name={form.name || 'Category'} src={previewSrc} size="lg" />
          <div className="flex flex-col gap-1">
            <label className="inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-md bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50 hover:text-brand-600">
              <Icon name="add" className="h-3.5 w-3.5" />
              {previewSrc ? 'Change image' : 'Upload image'}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => setImageFile(event.target.files?.[0] || null)}
              />
            </label>
            <p className="text-2xs text-ink-faint">Optimized to WebP automatically. Square 600×600 recommended.</p>
          </div>
        </div>
      </div>

      <Input
        id="category-name"
        label="Category name"
        required
        placeholder="e.g. Electronics, Footwear, Home Decor"
        value={form.name}
        onChange={(event) => setForm((c) => ({ ...c, name: event.target.value }))}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Select
          id="category-depth"
          label="Hierarchy level"
          options={DEPTH_OPTIONS}
          value={form.depth}
          onChange={(event) => {
            const nextDepth = event.target.value
            setForm((c) => ({
              ...c,
              depth: nextDepth,
              parent: nextDepth === '0' ? '' : c.parent || parentCategories[0]?.id || '',
            }))
          }}
        />

        {form.depth === '1' && (
          <Select
            id="category-parent"
            label="Parent category"
            options={parentOptions}
            value={form.parent}
            required
            onChange={(event) => setForm((c) => ({ ...c, parent: event.target.value }))}
          />
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          id="category-commission"
          label="Commission rate"
          suffix="%"
          inputMode="decimal"
          placeholder="e.g. 12 (Blank to inherit)"
          className="tabular text-right"
          description={form.depth === '1' ? 'Leave empty to inherit parent rate.' : 'Default marketplace rate.'}
          value={form.commissionRate}
          onChange={(event) => setForm((c) => ({ ...c, commissionRate: event.target.value }))}
        />

        <Select
          id="category-status"
          label="Publish status"
          options={CATEGORY_STATUS_OPTIONS}
          value={form.status}
          onChange={(event) => setForm((c) => ({ ...c, status: event.target.value }))}
        />
      </div>

      <Textarea
        id="category-description"
        label="Description (Optional)"
        rows={2}
        placeholder="Brief description for SEO or catalog taxonomy notes..."
        value={form.description}
        onChange={(event) => setForm((c) => ({ ...c, description: event.target.value }))}
      />
    </FormDrawer>
  )
}

export function BrandFormDrawer({ isOpen, onClose, brand, writer }) {
  const editing = Boolean(brand)
  const [logoFile, setLogoFile] = useState(null)
  const [form, setForm] = useState(() => ({
    name: brand?.name ?? '',
    owner: brand?.owner ?? 'In-house',
    website: brand?.website ?? '',
    description: brand?.description ?? '',
    status: brand?.status ?? 'live',
  }))
  const [issue, setIssue] = useState(null)

  const mutation = editing ? writer.update : writer.create

  function handleSubmit(event) {
    event.preventDefault()
    const payload = {
      name: form.name.trim(),
      owner: form.owner.trim() || 'In-house',
      website: form.website.trim(),
      description: form.description.trim(),
      status: form.status,
    }

    const result = brandWriteSchema.safeParse(payload)
    if (!result.success) {
      setIssue(result.error.issues[0]?.message || 'Validation error')
      return
    }
    setIssue(null)

    if (logoFile) {
      payload.logo = logoFile
    }

    mutation.run(editing ? { id: brand.id, ...payload } : payload)
  }

  const previewSrc = logoFile ? URL.createObjectURL(logoFile) : brand?.logo || undefined

  return (
    <FormDrawer
      isOpen={isOpen}
      onClose={onClose}
      title={editing ? `Edit brand: ${brand.name}` : 'Register new brand'}
      description="Add brands that products can be assigned to. Approved brands appear immediately."
      submitLabel={editing ? 'Save brand' : 'Create brand'}
      isSubmitting={mutation.isSubmitting}
      error={issue ? { message: issue } : mutation.error}
      onSubmit={handleSubmit}
      width="lg"
    >
      {/* Brand Logo Upload */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
          Brand Logo
        </label>
        <div className="flex items-center gap-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-3.5 transition-colors hover:border-brand-300">
          <Avatar name={form.name || 'Brand'} src={previewSrc} size="lg" />
          <div className="flex flex-col gap-1">
            <label className="inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-md bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50 hover:text-brand-600">
              <Icon name="add" className="h-3.5 w-3.5" />
              {previewSrc ? 'Change logo' : 'Upload logo'}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => setLogoFile(event.target.files?.[0] || null)}
              />
            </label>
            <p className="text-2xs text-ink-faint">Square logo with clean background (PNG, WebP or JPG).</p>
          </div>
        </div>
      </div>

      <Input
        id="brand-name"
        label="Brand name"
        required
        placeholder="e.g. Boat, Philips, Krozenda Essentials"
        value={form.name}
        onChange={(event) => setForm((c) => ({ ...c, name: event.target.value }))}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          id="brand-owner"
          label="Owner / Manufacturer"
          placeholder="e.g. In-house or vendor entity name"
          value={form.owner}
          onChange={(event) => setForm((c) => ({ ...c, owner: event.target.value }))}
        />

        <Select
          id="brand-status"
          label="Review status"
          options={BRAND_STATUS_OPTIONS}
          value={form.status}
          onChange={(event) => setForm((c) => ({ ...c, status: event.target.value }))}
        />
      </div>

      <Input
        id="brand-website"
        label="Brand website"
        placeholder="https://branddomain.com"
        value={form.website}
        onChange={(event) => setForm((c) => ({ ...c, website: event.target.value }))}
      />

      <Textarea
        id="brand-description"
        label="About the brand (Optional)"
        rows={2}
        placeholder="Brand story, authenticity notes, warranty terms..."
        value={form.description}
        onChange={(event) => setForm((c) => ({ ...c, description: event.target.value }))}
      />
    </FormDrawer>
  )
}

export function AttributeFormDrawer({ isOpen, onClose, attribute, writer }) {
  const editing = Boolean(attribute)
  const [form, setForm] = useState(() => ({
    name: attribute?.name ?? '',
    type: attribute?.type ?? 'select',
    values: (attribute?.values ?? []).join('\n'),
  }))
  const [issue, setIssue] = useState(null)

  const mutation = editing ? writer.update : writer.create

  function handleSubmit(event) {
    event.preventDefault()
    const payload = {
      name: form.name,
      type: form.type,
      values: form.values.split('\n').map((value) => value.trim()).filter(Boolean),
    }
    const result = attributeWriteSchema.safeParse(payload)
    if (!result.success) {
      setIssue(result.error.issues[0].message)
      return
    }
    setIssue(null)
    mutation.run(editing ? { id: attribute.id, ...payload } : payload)
  }

  return (
    <FormDrawer
      isOpen={isOpen}
      onClose={onClose}
      title={editing ? `Edit ${attribute.name}` : 'New attribute'}
      description="The option set a Variable product builds its variants from."
      submitLabel={editing ? 'Save changes' : 'Create attribute'}
      isSubmitting={mutation.isSubmitting}
      error={issue ? { message: issue } : mutation.error}
      onSubmit={handleSubmit}
    >
      <Input
        id="attribute-name"
        label="Name"
        required
        placeholder="Size, Colour, Capacity…"
        value={form.name}
        onChange={(event) => setForm((c) => ({ ...c, name: event.target.value }))}
      />
      <Select
        id="attribute-type"
        label="Type"
        options={TYPE_OPTIONS}
        value={form.type}
        onChange={(event) => setForm((c) => ({ ...c, type: event.target.value }))}
      />
      <Textarea
        id="attribute-values"
        label="Values"
        rows={6}
        required
        placeholder={'One per line\nS\nM\nL'}
        description="One value per line."
        value={form.values}
        onChange={(event) => setForm((c) => ({ ...c, values: event.target.value }))}
      />
    </FormDrawer>
  )
}

export function InventoryAdjustDialog({ isOpen, onClose, row, adjust }) {
  const [onHand, setOnHand] = useState(String(row.onHand))
  const [reason, setReason] = useState('')
  const [issue, setIssue] = useState(null)

  const next = Number(onHand)
  const projected = Number.isFinite(next) ? next - row.reserved : null

  function submit() {
    const payload = { onHand: Math.round(next), reason }
    const result = inventoryAdjustSchema.safeParse(payload)
    if (!result.success) {
      setIssue(result.error.issues[0].message)
      return
    }
    setIssue(null)
    adjust.run({ id: row.id, ...payload })
  }

  return (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={submit}
      title={`Adjust stock — ${row.sku}`}
      description={`${row.onHand} on hand today, ${row.reserved} of them reserved by open carts.`}
      confirmLabel="Post adjustment"
      tone="primary"
      isSubmitting={adjust.isSubmitting}
    >
      <div className="flex flex-col gap-3">
        <Input
          id="inventory-onhand"
          label="New on-hand count"
          required
          inputMode="numeric"
          className="tabular text-right"
          value={onHand}
          description={projected == null ? undefined : `${projected} would be available to sell`}
          onChange={(event) => setOnHand(event.target.value)}
        />
        <Textarea
          id="inventory-reason"
          label="Reason"
          rows={2}
          required
          placeholder="Cycle count, damage write-off, receipt correction…"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
        {(issue || adjust.error) && (
          <p className="text-xs text-danger-700">{issue || adjust.error.message}</p>
        )}
      </div>
    </ConfirmDialog>
  )
}
