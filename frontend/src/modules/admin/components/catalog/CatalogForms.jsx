import { useId, useState } from 'react'
import {
  CollapsibleSection,
  PriceTierEditor,
  ShippingFields,
  TaxFields,
  VariantEditor,
} from '../../../../components/catalog/ProductAdvancedFields'
import { Avatar, Badge, Button, Checkbox, Icon, Input, Modal, Select, SegmentedControl, Textarea } from '../../../../components/ui'
import { FormDrawer } from '../forms'
import { InlineAlert } from '../feedback'
import { ConfirmDialog } from '../overlay/ConfirmDialog'
import { ProductBarcode } from '../../../../components/common/ProductBarcode'
import {
  attributeWriteSchema,
  brandWriteSchema,
  categoryWriteSchema,
  inventoryAdjustSchema,
  productWriteSchema,
} from '../../schemas/catalogSchema'

export function CategoryFormDrawer({ isOpen, onClose, category, writer }) {
  const editing = Boolean(category)
  const [imageFile, setImageFile] = useState(null)
  const [form, setForm] = useState(() => ({
    name: category?.name ?? '',
    isActive: category?.isActive ?? true,
    isTopCategory: category?.isTopCategory ?? false,
  }))
  const [issue, setIssue] = useState(null)

  const mutation = editing ? writer.update : writer.create

  function handleSubmit(event) {
    event.preventDefault()

    const payload = {
      name: form.name.trim(),
      isActive: form.isActive,
      isTopCategory: form.isTopCategory,
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

  return (
    <FormDrawer
      isOpen={isOpen}
      onClose={onClose}
      title={editing ? `Edit ${category.name}` : 'Create category'}
      description="Name, image, visibility and top category status — configure catalog presentation."
      submitLabel={editing ? 'Save changes' : 'Create category'}
      isSubmitting={mutation.isSubmitting}
      error={issue ? { message: issue } : mutation.error}
      onSubmit={handleSubmit}
      width="md"
    >
      {/* Category Image Upload Area */}
      <div className="flex flex-col gap-2">
        <label className="text-2xs font-bold uppercase tracking-wider text-slate-500">
          Category Image / Thumbnail
        </label>
        <div className="flex items-center gap-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-4 transition-colors hover:border-brand-400">
          {previewSrc ? (
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
              <img src={previewSrc} alt="Preview" className="h-full w-full object-cover" />
            </div>
          ) : (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-50 to-indigo-50 text-brand-600 ring-1 ring-brand-100">
              <Icon name="categories" className="h-7 w-7" />
            </div>
          )}
          <div className="flex flex-1 flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs ring-1 ring-inset ring-slate-200 hover:bg-slate-50 hover:text-brand-600 transition-all">
                <Icon name="upload" className="h-3.5 w-3.5" />
                <span>{previewSrc ? 'Change Image' : 'Choose File'}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => setImageFile(event.target.files?.[0] || null)}
                />
              </label>
              {imageFile && (
                <button
                  type="button"
                  onClick={() => setImageFile(null)}
                  className="rounded-xl px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors"
                >
                  Clear Selection
                </button>
              )}
            </div>
            <p className="text-2xs text-slate-400">Recommended: Square PNG, WebP or JPG at least 600×600 px.</p>
          </div>
        </div>
      </div>

      <Input
        id="category-name"
        label="Category Name"
        required
        placeholder="e.g. Electronics, Footwear, Home Decor"
        value={form.name}
        onChange={(event) => setForm((c) => ({ ...c, name: event.target.value }))}
      />

      {/* Top Category Feature Flag */}
      <div className="rounded-2xl border border-amber-200/90 bg-gradient-to-r from-amber-50/80 via-orange-50/40 to-yellow-50/30 p-4 transition-all">
        <label className="flex items-start gap-3.5 cursor-pointer">
          <input
            type="checkbox"
            id="category-top"
            checked={form.isTopCategory}
            onChange={(event) => setForm((c) => ({ ...c, isTopCategory: event.target.checked }))}
            className="mt-0.5 h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900">Top Category (Spotlight & Priority)</span>
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 ring-1 ring-amber-300/60">
                ⭐ Top
              </span>
            </div>
            <p className="mt-0.5 text-2xs text-slate-600">
              Feature this category on the storefront homepage, top category navigation bar, and priority filter discovery.
            </p>
          </div>
        </label>
      </div>

      <Checkbox
        id="category-active"
        label="Active & Visible"
        description="Active categories are published to customer storefronts and navigation menus."
        checked={form.isActive}
        onChange={(event) => setForm((c) => ({ ...c, isActive: event.target.checked }))}
      />

      {/* Live Preview Card */}
      <div className="mt-2 flex flex-col gap-2 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4">
        <span className="text-2xs font-bold uppercase tracking-wider text-slate-400">
          Live Card Preview
        </span>
        <div className="flex items-center gap-3.5 rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
          {previewSrc ? (
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-slate-200/80 bg-slate-50 shadow-xs">
              <img src={previewSrc} alt="Preview" className="h-full w-full object-cover" />
            </div>
          ) : (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500/10 to-indigo-500/10 text-brand-600 font-bold text-sm ring-1 ring-brand-500/20">
              {form.name ? form.name.slice(0, 2).toUpperCase() : 'CT'}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="font-bold text-slate-900 text-sm truncate">{form.name || 'Category Name'}</p>
              {form.isTopCategory && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 ring-1 ring-amber-400/40">
                  ⭐ Top Category
                </span>
              )}
            </div>
            <div className="mt-1 flex items-center gap-2">
              <Badge tone={form.isActive ? 'success' : 'neutral'} dot size="sm">
                {form.isActive ? 'Active in Store' : 'Hidden from Store'}
              </Badge>
            </div>
          </div>
        </div>
      </div>
    </FormDrawer>
  )
}

export function BrandFormDrawer({ isOpen, onClose, brand, writer }) {
  const editing = Boolean(brand)
  const [logoFile, setLogoFile] = useState(null)
  const [form, setForm] = useState(() => ({
    name: brand?.name ?? '',
    isActive: brand?.isActive ?? true,
  }))
  const [issue, setIssue] = useState(null)

  const mutation = editing ? writer.update : writer.create

  function handleSubmit(event) {
    event.preventDefault()
    const payload = {
      name: form.name.trim(),
      isActive: form.isActive,
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
      description="Name, logo and visibility — configure brand directory identity."
      submitLabel={editing ? 'Save brand' : 'Create brand'}
      isSubmitting={mutation.isSubmitting}
      error={issue ? { message: issue } : mutation.error}
      onSubmit={handleSubmit}
      width="md"
    >
      {/* Brand Logo Upload */}
      <div className="flex flex-col gap-2">
        <label className="text-2xs font-bold uppercase tracking-wider text-slate-500">
          Brand Logo
        </label>
        <div className="flex items-center gap-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-4 transition-colors hover:border-brand-400">
          {previewSrc ? (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-xs">
              <img src={previewSrc} alt="Preview" className="max-h-full max-w-full object-contain" />
            </div>
          ) : (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 text-amber-700 ring-1 ring-amber-100">
              <Icon name="brands" className="h-7 w-7" />
            </div>
          )}
          <div className="flex flex-1 flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs ring-1 ring-inset ring-slate-200 hover:bg-slate-50 hover:text-brand-600 transition-all">
                <Icon name="upload" className="h-3.5 w-3.5" />
                <span>{previewSrc ? 'Change Logo' : 'Upload Logo'}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => setLogoFile(event.target.files?.[0] || null)}
                />
              </label>
              {logoFile && (
                <button
                  type="button"
                  onClick={() => setLogoFile(null)}
                  className="rounded-xl px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors"
                >
                  Clear Selection
                </button>
              )}
            </div>
            <p className="text-2xs text-slate-400">Square logo with clean background (PNG, WebP or SVG).</p>
          </div>
        </div>
      </div>

      <Input
        id="brand-name"
        label="Brand Name"
        required
        placeholder="e.g. Boat, Philips, Krozenda Essentials"
        value={form.name}
        onChange={(event) => setForm((c) => ({ ...c, name: event.target.value }))}
      />

      <Checkbox
        id="brand-active"
        label="Active & Visible"
        description="Active brands are selectable when creating products and visible in customer filter menus."
        checked={form.isActive}
        onChange={(event) => setForm((c) => ({ ...c, isActive: event.target.checked }))}
      />

      {/* Live Preview Card */}
      <div className="mt-2 flex flex-col gap-2 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4">
        <span className="text-2xs font-bold uppercase tracking-wider text-slate-400">
          Live Card Preview
        </span>
        <div className="flex items-center gap-3.5 rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
          {previewSrc ? (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200/80 bg-white p-1 shadow-xs">
              <img src={previewSrc} alt="Preview" className="max-h-full max-w-full object-contain" />
            </div>
          ) : (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 text-amber-700 font-bold text-sm ring-1 ring-amber-500/20">
              {form.name ? form.name.slice(0, 2).toUpperCase() : 'BR'}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-bold text-slate-900 text-sm truncate">{form.name || 'Brand Name'}</p>
            <div className="mt-1 flex items-center gap-2">
              <Badge tone={form.isActive ? 'success' : 'neutral'} dot size="sm">
                {form.isActive ? 'Active in Catalog' : 'Hidden from Catalog'}
              </Badge>
            </div>
          </div>
        </div>
      </div>
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

const MAX_PRODUCT_IMAGES = 5

const DISCOUNT_TYPE_OPTIONS = [
  { id: 'percentage', label: '% Percentage' },
  { id: 'flat', label: '₹ Flat amount' },
]

function round2(value) {
  return Math.round(value * 100) / 100
}

// Strips anything that isn't a digit or the first "." — so typing "-" or
// pasting "1-2e5" can never leave a negative or scientific-notation value.
function sanitizeDecimalInput(raw) {
  const cleaned = raw.replace(/[^0-9.]/g, '')
  const firstDot = cleaned.indexOf('.')
  if (firstDot === -1) return cleaned
  return cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '')
}

function sanitizeIntegerInput(raw) {
  return raw.replace(/[^0-9]/g, '')
}

// Only rewrites the text when the number actually exceeds the cap, so a
// trailing "." typed mid-decimal (e.g. "12.") isn't stripped on every keystroke.
function clampDecimalText(text, max) {
  if (text === '' || text === '.') return text
  const n = Number(text)
  if (!Number.isFinite(n) || n <= max) return text
  return String(max)
}

function blockNegativeKeys(event) {
  if (event.key === '-' || event.key === '+' || event.key === 'e' || event.key === 'E') {
    event.preventDefault()
  }
}

export function ProductFormDrawer({ isOpen, onClose, product, categories = [], brands = [], writer }) {
  const editing = Boolean(product)

  const [form, setForm] = useState(() => ({
    name: product?.name ?? '',
    sku: product?.sku ?? '',
    category: product?.category?.id ?? '',
    brand: product?.brand?.id ?? '',
    price: product?.price != null ? String(product.price) : '',
    salePrice: product?.salePrice != null ? String(product.salePrice) : '',
    discountType: 'percentage',
    discountValue: product?.discountPercent ? String(product.discountPercent) : '',
    stock: product?.stock != null ? String(product.stock) : '0',
    weight: product?.weight != null ? String(product.weight) : '',
    // Shipping, tax and B2B. Mirrors the seller panel's form exactly — both
    // render the same components from components/catalog.
    dimensions: {
      lengthCm: product?.dimensions?.lengthCm != null ? String(product.dimensions.lengthCm) : '',
      breadthCm: product?.dimensions?.breadthCm != null ? String(product.dimensions.breadthCm) : '',
      heightCm: product?.dimensions?.heightCm != null ? String(product.dimensions.heightCm) : '',
    },
    hsnCode: product?.hsnCode ?? '',
    gstRate: product?.gstRate != null ? String(product.gstRate) : '',
    moq: product?.moq != null ? String(product.moq) : '1',
    priceTiers: (product?.priceTiers ?? []).map((t) => ({ minQty: String(t.minQty), price: String(t.price) })),
    // Existing variants keep their id, so editing one does not orphan the
    // carts and orders pointing at it.
    variants: (product?.variants ?? []).map((v) => ({
      id: v.id,
      name: v.name ?? '',
      sku: v.sku ?? '',
      price: v.price != null ? String(v.price) : '',
      salePrice: v.salePrice != null ? String(v.salePrice) : '',
      stock: v.stock != null ? String(v.stock) : '0',
      isActive: v.isActive !== false,
    })),
    description: product?.description ?? '',
    isActive: product?.isActive ?? true,
    isFlashsale: product?.isFlashsale ?? false,
    isTrending: product?.isTrending ?? false,
  }))
  const [keptImages, setKeptImages] = useState(() => product?.images ?? [])
  const [newFiles, setNewFiles] = useState([])
  const [issue, setIssue] = useState(null)

  const mutation = editing ? writer.update : writer.create
  const totalImages = keptImages.length + newFiles.length

  function updateField(key, rawValue) {
    setForm((current) => {
      // Switching % <-> ₹ converts the entered discount so Sale Price doesn't jump.
      if (key === 'discountType') {
        const price = Number(current.price) || 0
        const currentValue = current.discountValue === '' ? null : Number(current.discountValue)
        let discountValue = current.discountValue
        if (price > 0 && currentValue != null) {
          discountValue =
            rawValue === 'flat'
              ? String(round2((currentValue / 100) * price))
              : String(Math.round((currentValue / price) * 100))
        }
        return { ...current, discountType: rawValue, discountValue }
      }

      if (key === 'stock') {
        return { ...current, stock: sanitizeIntegerInput(rawValue) }
      }

      if (key === 'weight') {
        return { ...current, weight: sanitizeDecimalInput(rawValue) }
      }

      // Regular Price: Sale Price can never exceed it, so clamp Sale Price
      // down along with it and recompute the discount from the new numbers.
      if (key === 'price') {
        const value = sanitizeDecimalInput(rawValue)
        const price = Number(value) || 0
        const next = { ...current, price: value }

        if (price > 0 && current.salePrice !== '') {
          next.salePrice = clampDecimalText(current.salePrice, price)
        }

        const sp = next.salePrice === '' ? null : Number(next.salePrice)
        if (price > 0 && sp != null && sp <= price) {
          next.discountValue =
            current.discountType === 'flat'
              ? String(round2(price - sp))
              : String(Math.round(((price - sp) / price) * 100))
        }

        return next
      }

      // Sale Price: can never be typed above the Regular Price.
      if (key === 'salePrice') {
        const price = Number(current.price) || 0
        let value = sanitizeDecimalInput(rawValue)
        if (price > 0) value = clampDecimalText(value, price)
        const next = { ...current, salePrice: value }

        const sp = value === '' ? null : Number(value)
        if (price > 0 && sp != null) {
          next.discountValue =
            current.discountType === 'flat'
              ? String(round2(price - sp))
              : String(Math.round(((price - sp) / price) * 100))
        } else if (sp == null) {
          next.discountValue = ''
        }

        return next
      }

      // Discount: percentage caps at 100, flat amount caps at the Regular
      // Price (a flat discount bigger than the price makes no sense).
      if (key === 'discountValue') {
        const price = Number(current.price) || 0
        const max = current.discountType === 'percentage' ? 100 : price
        let value = sanitizeDecimalInput(rawValue)
        if (price > 0 || current.discountType === 'percentage') {
          value = clampDecimalText(value, max)
        }
        const next = { ...current, discountValue: value }

        const dv = value === '' ? null : Number(value)
        if (price > 0 && dv != null) {
          next.salePrice =
            current.discountType === 'flat'
              ? String(round2(price - dv))
              : String(round2(price - (price * dv) / 100))
        } else if (dv == null) {
          next.salePrice = ''
        }

        return next
      }

      return { ...current, [key]: rawValue }
    })
  }

  function addFiles(fileList) {
    const files = Array.from(fileList || [])
    if (!files.length) return
    setNewFiles((current) => [...current, ...files].slice(0, Math.max(0, MAX_PRODUCT_IMAGES - keptImages.length)))
  }

  function removeKeptImage(url) {
    setKeptImages((current) => current.filter((img) => img !== url))
  }

  function removeNewFile(index) {
    setNewFiles((current) => current.filter((_, i) => i !== index))
  }

  function handleSubmit(event) {
    event.preventDefault()

    const priceNum = Number(form.price)
    const salePriceNum = form.salePrice.trim() === '' ? null : Number(form.salePrice)
    // discountPercent is always derived from price/salePrice, not typed directly —
    // that keeps it correct whether the admin entered a % or a flat ₹ amount.
    const discountNum =
      salePriceNum != null && priceNum > 0 && salePriceNum < priceNum
        ? Math.round(((priceNum - salePriceNum) / priceNum) * 100)
        : 0
    const stockNum = Number(form.stock)
    const weightNum = form.weight.trim() === '' ? null : Number(form.weight)

    const payload = {
      name: form.name.trim(),
      category: form.category,
      price: priceNum,
      salePrice: salePriceNum,
      discountPercent: discountNum,
      stock: stockNum,
      weight: weightNum,
      isActive: form.isActive,
      isFlashsale: form.isFlashsale,
      isTrending: form.isTrending,
    }

    const result = productWriteSchema.safeParse(payload)
    if (!result.success) {
      setIssue(result.error.issues[0]?.message || 'Validation error')
      return
    }

    if (totalImages === 0) {
      setIssue('Add at least one product image')
      return
    }

    setIssue(null)

    const dims = form.dimensions
    const body = {
      ...payload,
      sku: form.sku.trim(),
      brand: form.brand,
      description: form.description,
      images: newFiles,

      hsnCode: form.hsnCode.trim(),
      // '' is a real choice here ("not classified"), so it is sent rather
      // than omitted — omitting it would leave a stale rate in place.
      gstRate: form.gstRate,
      moq: form.moq,
      // All three or none: the server stores a partial set as null anyway.
      dimensions:
        dims.lengthCm && dims.breadthCm && dims.heightCm
          ? { lengthCm: Number(dims.lengthCm), breadthCm: Number(dims.breadthCm), heightCm: Number(dims.heightCm) }
          : null,
      priceTiers: form.priceTiers
        .filter((t) => t.minQty && t.price)
        .map((t) => ({ minQty: Number(t.minQty), price: Number(t.price) })),
      variants: form.variants
        .filter((v) => v.name?.trim())
        .map((v) => ({
          ...(v.id ? { id: v.id } : {}),
          name: v.name.trim(),
          sku: v.sku || '',
          // Empty means "inherit the parent's price", which is not the same
          // as zero.
          price: v.price === '' ? null : Number(v.price),
          salePrice: v.salePrice === '' ? null : Number(v.salePrice),
          stock: Number(v.stock) || 0,
          isActive: v.isActive !== false,
        })),
    }

    if (editing) {
      const removeImages = (product.images || []).filter((img) => !keptImages.includes(img))
      mutation.run({ id: product.id, ...body, removeImages })
    } else {
      mutation.run(body)
    }
  }

  // Cover image preview source for Live Preview
  const previewCover =
    newFiles.length > 0 && keptImages.length === 0
      ? URL.createObjectURL(newFiles[0])
      : keptImages[0] || (newFiles[0] ? URL.createObjectURL(newFiles[0]) : null)

  const selectedCategory = categories.find((c) => c.id === form.category)
  const selectedBrand = brands.find((b) => b.id === form.brand)

  // Recomputed straight from price/salePrice, independent of discountType —
  // matches what handleSubmit actually sends.
  const previewPrice = Number(form.price) || 0
  const previewSalePrice = Number(form.salePrice) || 0
  const previewDiscountPercent =
    previewPrice > 0 && previewSalePrice > 0 && previewSalePrice < previewPrice
      ? Math.round(((previewPrice - previewSalePrice) / previewPrice) * 100)
      : 0

  return (
    <FormDrawer
      isOpen={isOpen}
      onClose={onClose}
      title={editing ? `Edit: ${product.name}` : 'Create New Product'}
      description="Images, specifications, pricing and stock management."
      submitLabel={editing ? 'Save changes' : 'Create product'}
      isSubmitting={mutation.isSubmitting}
      error={issue ? { message: issue } : mutation.error}
      onSubmit={handleSubmit}
      width="lg"
    >
      {/* Product Images Gallery */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-2xs font-bold uppercase tracking-wider text-slate-500">
            Product Images & Gallery ({totalImages}/{MAX_PRODUCT_IMAGES})
          </label>
          <span className="text-2xs text-slate-400 font-medium">First image will be the primary cover</span>
        </div>

        <div className="flex flex-wrap gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-4 transition-colors hover:border-brand-400">
          {keptImages.map((url, index) => (
            <div
              key={url}
              className="group relative h-22 w-22 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs"
            >
              <img src={url} alt="" className="h-full w-full object-cover" />
              {index === 0 && (
                <span className="absolute bottom-1 left-1 rounded bg-slate-900/80 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                  Cover
                </span>
              )}
              <button
                type="button"
                onClick={() => removeKeptImage(url)}
                className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-white shadow-xs opacity-90 hover:opacity-100 transition-opacity"
                title="Remove image"
              >
                <Icon name="close" className="h-3 w-3" />
              </button>
            </div>
          ))}

          {newFiles.map((file, index) => {
            const isCover = keptImages.length === 0 && index === 0
            return (
              <div
                key={`${file.name}-${index}`}
                className="group relative h-22 w-22 shrink-0 overflow-hidden rounded-xl border border-brand-300 bg-white shadow-xs ring-2 ring-brand-100"
              >
                <img src={URL.createObjectURL(file)} alt="" className="h-full w-full object-cover" />
                {isCover && (
                  <span className="absolute bottom-1 left-1 rounded bg-brand-600 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                    Cover
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => removeNewFile(index)}
                  className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-white shadow-xs opacity-90 hover:opacity-100 transition-opacity"
                  title="Remove image"
                >
                  <Icon name="close" className="h-3 w-3" />
                </button>
              </div>
            )
          })}

          {totalImages < MAX_PRODUCT_IMAGES && (
            <label className="flex h-22 w-22 shrink-0 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-slate-300 bg-white text-slate-500 hover:border-brand-500 hover:text-brand-600 hover:bg-brand-50/40 transition-all">
              <Icon name="upload" className="h-5 w-5" />
              <span className="text-2xs font-semibold">Upload</span>
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(event) => {
                  addFiles(event.target.files)
                  event.target.value = ''
                }}
              />
            </label>
          )}
        </div>
        <p className="text-2xs text-slate-400">High-resolution PNG, JPG or WebP. Square 1:1 or 4:3 aspect ratio recommended.</p>
      </div>

      {/* Product Name */}
      <Input
        id="product-name"
        label="Product Name"
        required
        placeholder="e.g. Wireless ANC Noise Cancelling Headphones"
        value={form.name}
        onChange={(event) => updateField('name', event.target.value)}
      />

      {/* Category & Brand */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select
          id="product-category"
          label="Category"
          required
          placeholder="Select a category"
          options={categories.map((c) => ({ value: c.id, label: c.name }))}
          value={form.category}
          onChange={(event) => updateField('category', event.target.value)}
        />
        <Select
          id="product-brand"
          label="Brand"
          options={[{ value: '', label: 'No brand' }, ...brands.map((b) => ({ value: b.id, label: b.name }))]}
          value={form.brand}
          onChange={(event) => updateField('brand', event.target.value)}
        />
      </div>

      {/* Pricing: Price, Sale Price, Discount */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <label className="text-2xs font-bold uppercase tracking-wider text-slate-500">
            Discount Type
          </label>
          <SegmentedControl
            items={DISCOUNT_TYPE_OPTIONS}
            activeId={form.discountType}
            onChange={(id) => updateField('discountType', id)}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Input
            id="product-price"
            label="Regular Price (₹)"
            required
            type="number"
            min="0"
            step="0.01"
            placeholder="e.g. 4999"
            value={form.price}
            onKeyDown={blockNegativeKeys}
            onChange={(event) => updateField('price', event.target.value)}
          />
          <Input
            id="product-sale-price"
            label="Sale Price (₹)"
            type="number"
            min="0"
            max={form.price || undefined}
            step="0.01"
            placeholder="e.g. 2999"
            description="Can't be higher than the regular price"
            value={form.salePrice}
            onKeyDown={blockNegativeKeys}
            onChange={(event) => updateField('salePrice', event.target.value)}
          />
          <Input
            id="product-discount"
            label={form.discountType === 'flat' ? 'Discount Amount (₹)' : 'Discount %'}
            type="number"
            min="0"
            max={form.discountType === 'flat' ? form.price || undefined : 100}
            step="0.01"
            placeholder={form.discountType === 'flat' ? 'e.g. 500' : 'e.g. 40'}
            value={form.discountValue}
            onKeyDown={blockNegativeKeys}
            onChange={(event) => updateField('discountValue', event.target.value)}
          />
        </div>
      </div>

      {/* Inventory, SKU & Weight */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Input
          id="product-stock"
          label="Stock / Quantity"
          required
          type="number"
          min="0"
          step="1"
          placeholder="0"
          value={form.stock}
          onKeyDown={blockNegativeKeys}
          onChange={(event) => updateField('stock', event.target.value)}
        />
        <Input
          id="product-sku"
          label="SKU Identifier"
          placeholder="e.g. BOAT-ANC-001"
          value={form.sku}
          onChange={(event) => updateField('sku', event.target.value)}
        />
        <Input
          id="product-weight"
          label="Weight (kg)"
          type="number"
          min="0"
          step="0.01"
          placeholder="e.g. 0.35"
          value={form.weight}
          onKeyDown={blockNegativeKeys}
          onChange={(event) => updateField('weight', event.target.value)}
        />
      </div>

      {/* Assigned automatically on creation — see Models/Product.js — so a
          brand new product has none to show until it has been saved once. */}
      {editing && product.barcode && (
        <ProductBarcode
          code={product.barcode}
          imageUrl={`/admin/catalog/products/${product.id}/barcode.png`}
          className="max-w-xs"
        />
      )}

      {/* Description */}
      <Textarea
        id="product-description"
        label="Description & Specifications"
        rows={4}
        placeholder="Product overview, key features, technical specifications, and box contents…"
        value={form.description}
        onChange={(event) => updateField('description', event.target.value)}
      />

      {/* Shipping, tax and B2B. Collapsed and rendered from the shared
          components/catalog set, so this drawer and the seller panel's Add
          Product modal cannot drift on validation or wording. */}
      <CollapsibleSection
        title="Shipping"
        description="Weight and dimensions — these decide what a courier charges."
        badge={form.weight || form.dimensions.lengthCm ? 'Set' : null}
      >
        <ShippingFields value={form} onChange={(next) => setForm(next)} />
      </CollapsibleSection>

      <CollapsibleSection
        title="Tax"
        description="HSN code and GST rate for invoicing."
        badge={form.hsnCode || form.gstRate ? 'Set' : null}
      >
        <TaxFields value={form} onChange={(next) => setForm(next)} />
      </CollapsibleSection>

      <CollapsibleSection
        title="Bulk & wholesale pricing"
        description="Minimum order quantity and per-unit price breaks."
        badge={form.priceTiers.length > 0 || form.moq !== '1' ? 'Set' : null}
      >
        <div className="flex flex-col gap-3">
          <Input
            id="product-moq"
            label="Minimum order quantity"
            type="number"
            min="1"
            value={form.moq}
            onChange={(event) => updateField('moq', event.target.value)}
            description="1 means no minimum. Buyers cannot check out below this."
            containerClassName="sm:max-w-xs"
          />
          <PriceTierEditor
            tiers={form.priceTiers}
            basePrice={form.salePrice || form.price}
            onChange={(priceTiers) => updateField('priceTiers', priceTiers)}
          />
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Options & variants"
        description="Sizes, colours or pack sizes with their own price and stock."
        badge={form.variants.length > 0 ? `${form.variants.length}` : null}
      >
        <VariantEditor variants={form.variants} onChange={(variants) => updateField('variants', variants)} />
      </CollapsibleSection>

      {/* Flash Sale Deal Feature Flag */}
      <div className="rounded-2xl border border-amber-200/90 bg-gradient-to-r from-amber-50/80 via-orange-50/40 to-yellow-50/30 p-4 transition-all">
        <label className="flex items-start gap-3.5 cursor-pointer">
          <input
            type="checkbox"
            id="product-flashsale"
            checked={form.isFlashsale}
            onChange={(event) => updateField('isFlashsale', event.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900">Flash Sale Deal (Limited Time / Spotlight)</span>
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 ring-1 ring-amber-300/60">
                🔥 Flash Sale
              </span>
            </div>
            <p className="mt-0.5 text-2xs text-slate-600">
              Highlight this product prominently in Flash Sale deals, countdown banners, and special high-urgency promotional sections.
            </p>
          </div>
        </label>
      </div>

      {/* Trending Product Feature Flag */}
      <div className="rounded-2xl border border-indigo-200/90 bg-gradient-to-r from-indigo-50/80 via-purple-50/40 to-violet-50/30 p-4 transition-all">
        <label className="flex items-start gap-3.5 cursor-pointer">
          <input
            type="checkbox"
            id="product-trending"
            checked={form.isTrending}
            onChange={(event) => updateField('isTrending', event.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900">Trending Product (High Reseller Demand)</span>
              <span className="inline-flex items-center gap-1 rounded-md bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-800 ring-1 ring-indigo-300/60">
                📈 Trending
              </span>
            </div>
            <p className="mt-0.5 text-2xs text-slate-600">
              Feature this product in Trending Picks, B2B wholesale high-margin showcases, and top-seller recommendation carousels.
            </p>
          </div>
        </label>
      </div>

      {/* Active Checkbox */}
      <Checkbox
        id="product-active"
        label="Active in Storefront"
        description="Active products are visible and purchasable across the store."
        checked={form.isActive}
        onChange={(event) => updateField('isActive', event.target.checked)}
      />

      {/* Real-time Live Catalog Preview Card */}
      <div className="mt-2 flex flex-col gap-2 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4">
        <div className="flex items-center justify-between">
          <span className="text-2xs font-bold uppercase tracking-wider text-slate-400">
            Live Catalog Preview
          </span>
          <span className="text-2xs text-slate-400">Preview of listing in customer search</span>
        </div>
        <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
          {previewCover ? (
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-slate-200/80 bg-slate-50 shadow-xs">
              <img src={previewCover} alt="Cover Preview" className="h-full w-full object-cover" />
            </div>
          ) : (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500/10 to-indigo-500/10 text-brand-600 font-bold text-base ring-1 ring-brand-500/20">
              {form.name ? form.name.slice(0, 2).toUpperCase() : 'PR'}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-bold text-slate-900 text-sm truncate">{form.name || 'Product Title'}</p>
              {form.isFlashsale && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 ring-1 ring-amber-400/40">
                  🔥 Flash Sale
                </span>
              )}
              {form.isTrending && (
                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 ring-1 ring-indigo-400/40">
                  📈 Trending
                </span>
              )}
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-2xs text-slate-500">
              <span>{selectedCategory?.name || 'Category'}</span>
              {selectedBrand?.name && <span>• {selectedBrand.name}</span>}
              {form.sku && <span>• SKU: {form.sku}</span>}
            </div>
            <div className="mt-1.5 flex items-center gap-2.5">
              <span className="font-bold text-slate-900 text-sm tabular">
                ₹{Number(form.salePrice || form.price || 0).toLocaleString('en-IN')}
              </span>
              {form.salePrice && form.price && Number(form.salePrice) < Number(form.price) && (
                <span className="text-2xs text-slate-400 line-through tabular">
                  ₹{Number(form.price).toLocaleString('en-IN')}
                </span>
              )}
              {previewDiscountPercent > 0 && (
                <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-2xs font-semibold text-emerald-700">
                  {previewDiscountPercent}% OFF
                </span>
              )}
              <Badge tone={form.isActive ? 'success' : 'neutral'} dot size="sm" className="ml-auto">
                {form.isActive ? 'Active' : 'Hidden'}
              </Badge>
            </div>
          </div>
        </div>
      </div>
    </FormDrawer>
  )
}

// Alias for backward compatibility
export const ProductFormModal = ProductFormDrawer

