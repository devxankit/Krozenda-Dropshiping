import { useEffect, useState } from 'react'
import { Badge, Button, Icon, Input, Modal, Select, SegmentedControl, Textarea } from '../../../../components/ui'
import { InlineAlert } from '../../../admin/components/feedback'
import { toast } from '../../../admin/stores/toastStore'
import { api } from '../../../../lib/axios'

const GST_RATE_OPTIONS = [
  { value: '', label: 'Select GST slab (optional)' },
  { value: '0', label: '0% (Exempt)' },
  { value: '5', label: '5%' },
  { value: '12', label: '12%' },
  { value: '18', label: '18%' },
  { value: '28', label: '28%' },
]

function formFromProduct(product) {
  return {
    name: product.name || '',
    sku: product.sku || '',
    category: product.category?.id || (typeof product.category === 'string' ? product.category : ''),
    brand: product.brand?.id || (typeof product.brand === 'string' ? product.brand : ''),
    shortDescription: product.shortDescription || '',
    description: product.description || '',
    price: product.price != null ? String(product.price) : '',
    mrp: product.mrp != null ? String(product.mrp) : '',
    costPrice: product.costPrice != null ? String(product.costPrice) : '',
    gstRate: product.gstRate != null ? String(product.gstRate) : '',
    stock: product.stock != null ? String(product.stock) : '0',
    lowStockThreshold: product.lowStockThreshold != null ? String(product.lowStockThreshold) : '',
    weight: product.weight != null ? String(product.weight) : '',
    status: product.status || (product.isActive === false ? 'Inactive' : 'Active'),
  }
}

export function EditVendorProductModal({ isOpen, onClose, product, onEditProduct }) {
  const [formData, setFormData] = useState(() => (product ? formFromProduct(product) : null))
  const [existingImages, setExistingImages] = useState(product?.images || [])
  const [removedImages, setRemovedImages] = useState([])
  const [newFiles, setNewFiles] = useState([])
  const [newPreviews, setNewPreviews] = useState([])
  const [categories, setCategories] = useState([])
  const [brands, setBrands] = useState([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!isOpen || !product) return
    api.get('/vendor/catalog/categories').then(({ data }) => setCategories(data.data.items.filter((c) => c.approvalStatus === 'APPROVED'))).catch(() => {})
    api.get('/vendor/catalog/brands').then(({ data }) => setBrands(data.data.items.filter((b) => b.approvalStatus === 'APPROVED'))).catch(() => {})
  }, [isOpen, product])

  if (!isOpen || !product || !formData) return null

  function handleFileUpload(e) {
    const selected = Array.from(e.target.files || [])
    if (!selected.length) return
    setNewFiles((prev) => [...prev, ...selected])
    setNewPreviews((prev) => [...prev, ...selected.map((f) => URL.createObjectURL(f))])
  }

  function handleRemoveNewImage(index) {
    setNewFiles((prev) => prev.filter((_, i) => i !== index))
    setNewPreviews((prev) => prev.filter((_, i) => i !== index))
  }

  function handleRemoveExistingImage(url) {
    setExistingImages((prev) => prev.filter((img) => img !== url))
    setRemovedImages((prev) => [...prev, url])
  }

  async function handleSubmit(e) {
    e.preventDefault()

    if (!formData.name.trim()) {
      toast.error('Missing Product Name', 'Please enter a product title.')
      return
    }
    if (!formData.sku.trim()) {
      toast.error('Missing SKU', 'Please enter a unique SKU identifier.')
      return
    }
    if (!formData.category) {
      toast.error('Missing Category', 'Please select a product category.')
      return
    }
    if (!formData.price || Number(formData.price) < 0) {
      toast.error('Invalid Selling Price', 'Please enter a valid selling price.')
      return
    }
    if (formData.stock === '' || Number(formData.stock) < 0) {
      toast.error('Invalid Stock', 'Please enter a valid stock quantity.')
      return
    }
    if (!formData.weight || Number(formData.weight) <= 0) {
      toast.error('Missing Weight', 'Please enter a shipping weight greater than 0 kg.')
      return
    }
    if (existingImages.length === 0 && newFiles.length === 0) {
      toast.error('Missing Main Image', 'Main image is required. Please keep or upload at least one image.')
      return
    }

    const body = new FormData()
    body.append('name', formData.name.trim())
    body.append('sku', formData.sku.trim())
    body.append('category', formData.category)
    body.append('brand', formData.brand || '')
    if (formData.shortDescription) body.append('shortDescription', formData.shortDescription.trim())
    if (formData.description) body.append('description', formData.description.trim())
    body.append('price', formData.price)
    if (formData.mrp) body.append('mrp', formData.mrp)
    if (formData.costPrice) body.append('costPrice', formData.costPrice)
    if (formData.gstRate) body.append('gstRate', formData.gstRate)
    body.append('stock', formData.stock || '0')
    if (formData.lowStockThreshold) body.append('lowStockThreshold', formData.lowStockThreshold)
    body.append('weight', formData.weight)
    body.append('status', formData.status || 'Active')

    if (removedImages.length > 0) body.append('removeImages', JSON.stringify(removedImages))
    newFiles.forEach((f) => body.append('images', f))

    setIsSubmitting(true)
    try {
      await onEditProduct({ id: product.id, formData: body })
      toast.success('Product Updated', `${formData.name.trim()} was saved.`)
      onClose()
    } catch (err) {
      toast.error('Could not update product', err?.response?.data?.message || 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  const totalImages = existingImages.length + newPreviews.length

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Product"
      description="Changes go live immediately on an approved product — a pending or rejected one stays under review."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} icon="save" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Save changes'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-h-[65vh] overflow-y-auto admin-scroll pr-1.5">
        {product.approvalStatus === 'REJECTED' && (
          <InlineAlert tone="danger" title="This listing was rejected">
            {product.rejectionReason || 'No reason was given.'} Fix the issue below and save — it stays rejected until you resubmit it.
          </InlineAlert>
        )}
        {product.approvalStatus === 'PENDING' && (
          <InlineAlert tone="info" title="Still awaiting admin approval">
            Edits here update the same pending listing — they don&apos;t restart the review queue.
          </InlineAlert>
        )}

        {/* SECTION 1: IMAGES */}
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface-subtle p-3.5">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-50 text-[10px] font-bold text-brand-600 ring-1 ring-brand-200">
                  1
                </span>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  Images & Photos <span className="text-rose-500">*</span>
                </h4>
              </div>
              <p className="mt-0.5 text-2xs text-ink-subtle">
                First image is the <strong className="text-slate-700">Main Cover Image</strong>. At least 1 image is required.
              </p>
            </div>
            {totalImages > 0 && (
              <Badge tone="brand" size="xs">
                {totalImages} {totalImages === 1 ? 'photo' : 'photos'}
              </Badge>
            )}
          </div>

          <label className="flex items-center justify-center gap-2 cursor-pointer rounded-md border border-dashed border-border bg-surface p-2.5 text-center transition-colors hover:border-brand-400 hover:bg-brand-50/50">
            <Icon name="upload" className="h-4 w-4 text-brand-600" />
            <span className="text-xs font-medium text-slate-900">Add More Image Files</span>
            <input type="file" accept="image/*" multiple onChange={handleFileUpload} className="hidden" />
          </label>

          {totalImages > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {existingImages.map((img, idx) => (
                <div key={img} className={`relative group h-16 w-16 overflow-hidden rounded-lg border bg-surface shadow-2xs ${idx === 0 ? 'border-brand-500 ring-2 ring-brand-200' : 'border-border'}`}>
                  <img src={img} alt={`Product thumbnail ${idx + 1}`} className="h-full w-full object-cover" />
                  {idx === 0 ? (
                    <span className="absolute left-0.5 top-0.5 rounded bg-brand-600 px-1 py-0.2 text-[8px] font-bold text-white shadow-2xs">
                      ★ Main
                    </span>
                  ) : (
                    <span className="absolute left-0.5 top-0.5 rounded bg-slate-900/70 px-1 py-0.2 text-[8px] font-medium text-white">
                      Gallery
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRemoveExistingImage(img)}
                    className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-slate-900/80 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-danger-600"
                    title="Remove image"
                  >
                    <Icon name="close" className="h-2.5 w-2.5" />
                  </button>
                </div>
              ))}
              {newPreviews.map((img, idx) => {
                const isCover = existingImages.length === 0 && idx === 0
                return (
                  <div key={img} className={`relative group h-16 w-16 overflow-hidden rounded-lg border bg-surface shadow-2xs ${isCover ? 'border-brand-500 ring-2 ring-brand-200' : 'border-brand-300'}`}>
                    <img src={img} alt={`New upload ${idx + 1}`} className="h-full w-full object-cover" />
                    {isCover ? (
                      <span className="absolute left-0.5 top-0.5 rounded bg-brand-600 px-1 py-0.2 text-[8px] font-bold text-white shadow-2xs">
                        ★ Main
                      </span>
                    ) : (
                      <span className="absolute left-0.5 top-0.5 rounded bg-emerald-600 px-1 py-0.2 text-[8px] font-bold text-white shadow-2xs">
                        New
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemoveNewImage(idx)}
                      className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-slate-900/80 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-danger-600"
                      title="Remove image"
                    >
                      <Icon name="close" className="h-2.5 w-2.5" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* SECTION 2: BASIC */}
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-3.5 shadow-2xs">
          <div className="flex items-center gap-1.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-50 text-[10px] font-bold text-brand-600 ring-1 ring-brand-200">
              2
            </span>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">Basic Details</h4>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Product Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              containerClassName="sm:col-span-2"
            />
            <Input
              label="SKU Identifier"
              value={formData.sku}
              onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
              required
            />
            <Select
              label="Category"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
              placeholder="Select category"
              required
            />
            <Select
              label="Brand (Optional)"
              value={formData.brand}
              onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
              options={brands.map((b) => ({ value: b.id, label: b.name }))}
              placeholder="No brand"
              containerClassName="sm:col-span-2"
            />
            <Textarea
              label="Short Description (Optional)"
              placeholder="Quick highlight in 1-2 lines..."
              rows={2}
              value={formData.shortDescription}
              onChange={(e) => setFormData({ ...formData, shortDescription: e.target.value })}
              containerClassName="sm:col-span-2"
            />
            <Textarea
              label="Description (Optional)"
              placeholder="Detailed specifications, features and material..."
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              containerClassName="sm:col-span-2"
            />
          </div>
        </div>

        {/* SECTION 3: PRICING */}
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-3.5 shadow-2xs">
          <div className="flex items-center gap-1.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-50 text-[10px] font-bold text-brand-600 ring-1 ring-brand-200">
              3
            </span>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">Pricing & Tax</h4>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              label="Selling Price (₹)"
              type="number"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              required
            />
            <Input
              label="MRP (₹, Optional)"
              type="number"
              placeholder="e.g. 2499"
              value={formData.mrp}
              onChange={(e) => setFormData({ ...formData, mrp: e.target.value })}
            />
            <Input
              label="Cost Price (₹, Optional)"
              type="number"
              placeholder="e.g. 1100"
              value={formData.costPrice}
              onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
            />
            <Select
              label="Tax / GST (Optional)"
              options={GST_RATE_OPTIONS}
              value={formData.gstRate}
              onChange={(e) => setFormData({ ...formData, gstRate: e.target.value })}
            />
          </div>
        </div>

        {/* SECTION 4: INVENTORY */}
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-3.5 shadow-2xs">
          <div className="flex items-center gap-1.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-50 text-[10px] font-bold text-brand-600 ring-1 ring-brand-200">
              4
            </span>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">Inventory</h4>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Stock Quantity"
              type="number"
              min="0"
              value={formData.stock}
              onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
              required
            />
            <Input
              label="Low Stock Threshold (Optional)"
              type="number"
              min="0"
              placeholder="10"
              value={formData.lowStockThreshold}
              onChange={(e) => setFormData({ ...formData, lowStockThreshold: e.target.value })}
              description="Alert trigger when inventory falls below this"
            />
          </div>
        </div>

        {/* SECTION 5: SHIPPING */}
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-3.5 shadow-2xs">
          <div className="flex items-center gap-1.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-50 text-[10px] font-bold text-brand-600 ring-1 ring-brand-200">
              5
            </span>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">Shipping</h4>
          </div>

          <Input
            label="Weight (kg)"
            type="number"
            min="0.001"
            step="0.01"
            placeholder="0.45"
            value={formData.weight}
            onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
            description="Package shipping weight in kilograms used for courier calculation"
            required
          />
        </div>

        {/* SECTION 6: PRODUCT STATUS */}
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-50 text-[10px] font-bold text-brand-600 ring-1 ring-brand-200">
                6
              </span>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Product Status <span className="text-rose-500">*</span>
              </h4>
            </div>
            <Badge tone={formData.status === 'Active' ? 'success' : formData.status === 'Draft' ? 'warning' : 'neutral'} dot size="xs">
              {formData.status}
            </Badge>
          </div>

          <SegmentedControl
            items={[
              { id: 'Active', label: 'Active (Live)' },
              { id: 'Draft', label: 'Draft' },
              { id: 'Inactive', label: 'Inactive' },
            ]}
            activeId={formData.status}
            onChange={(id) => setFormData({ ...formData, status: id })}
          />
          <p className="text-2xs text-ink-subtle">
            {formData.status === 'Active' && 'Active products are visible and purchasable across the store once approved.'}
            {formData.status === 'Draft' && 'Draft products remain saved as unpublished drafts.'}
            {formData.status === 'Inactive' && 'Inactive products remain disabled.'}
          </p>
        </div>
      </form>
    </Modal>
  )
}
