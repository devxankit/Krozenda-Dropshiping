import { useEffect, useState } from 'react'
import { GstTypeField } from '../../../../components/catalog/ProductAdvancedFields'
import { Badge, Button, Icon, Input, Modal, Select, SegmentedControl, Textarea } from '../../../../components/ui'
import { toast } from '../../../admin/stores/toastStore'
import { api } from '../../../../lib/axios'
import { ProductVariantsSection } from '../../../../components/catalog/ProductVariantsSection'
import { buildVariantsPayload } from '../../../../components/catalog/productVariants'

const GST_RATE_OPTIONS = [
  { value: '', label: 'Select GST slab (optional)' },
  { value: '0', label: '0% (Exempt)' },
  { value: '5', label: '5%' },
  { value: '12', label: '12%' },
  { value: '18', label: '18%' },
  { value: '28', label: '28%' },
]

const EMPTY_FORM = {
  name: '',
  sku: '',
  category: '',
  brand: '',
  shortDescription: '',
  description: '',
  price: '',
  mrp: '',
  costPrice: '',
  gstRate: '',
  gstInclusive: true,
  stock: '100',
  lowStockThreshold: '',
  weight: '',
  status: 'Active',
  isFlashsale: false,
  isTrending: false,
  isReturnable: true,
}

export function AddVendorProductModal({ isOpen, onClose, onAddProduct }) {
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [files, setFiles] = useState([])
  const [previews, setPreviews] = useState([])
  const [categories, setCategories] = useState([])
  const [brands, setBrands] = useState([])
  const [variants, setVariants] = useState([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    api.get('/vendor/catalog/categories').then(({ data }) => setCategories(data.data.items.filter((c) => c.approvalStatus !== 'PENDING' && c.approvalStatus !== 'REJECTED'))).catch(() => {})
    api.get('/vendor/catalog/brands').then(({ data }) => setBrands(data.data.items.filter((b) => b.approvalStatus !== 'PENDING' && b.approvalStatus !== 'REJECTED'))).catch(() => {})
  }, [isOpen])

  function handleFileUpload(e) {
    const selected = Array.from(e.target.files || [])
    if (!selected.length) return
    setFiles((prev) => [...prev, ...selected])
    setPreviews((prev) => [...prev, ...selected.map((f) => URL.createObjectURL(f))])
  }

  function handleRemoveImage(index) {
    // A variant pointing at the removed photo would point at nothing.
    setVariants((prev) => prev.map((v) => (v.image === files[index] ? { ...v, image: null } : v)))
    setFiles((prev) => prev.filter((_, i) => i !== index))
    setPreviews((prev) => prev.filter((_, i) => i !== index))
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
    if (files.length === 0) {
      toast.error('Missing Main Image', 'Main image is required. Please upload at least one image.')
      return
    }
    const variantResult = buildVariantsPayload(variants, { galleryFiles: files })
    if (variantResult.error) {
      toast.error('Check your variants', variantResult.error)
      return
    }

    const body = new FormData()
    body.append('name', formData.name.trim())
    body.append('sku', formData.sku.trim())
    body.append('category', formData.category)
    if (formData.brand) body.append('brand', formData.brand)
    if (formData.shortDescription) body.append('shortDescription', formData.shortDescription.trim())
    if (formData.description) body.append('description', formData.description.trim())
    body.append('price', formData.price)
    if (formData.mrp) body.append('mrp', formData.mrp)
    if (formData.costPrice) body.append('costPrice', formData.costPrice)
    if (formData.gstRate) body.append('gstRate', formData.gstRate)
    body.append('gstInclusive', formData.gstInclusive === false ? 'false' : 'true')
    body.append('stock', formData.stock || '0')
    if (formData.lowStockThreshold) body.append('lowStockThreshold', formData.lowStockThreshold)
    body.append('weight', formData.weight)
    body.append('status', formData.status || 'Active')
    body.append('isFlashsale', formData.isFlashsale)
    body.append('isTrending', formData.isTrending)
    body.append('isReturnable', formData.isReturnable)

    if (variantResult.variants.length > 0) body.append('variants', JSON.stringify(variantResult.variants))

    files.forEach((f) => body.append('images', f))

    setIsSubmitting(true)
    try {
      const newProduct = await onAddProduct(body)
      toast.success(
        formData.status === 'Draft' ? 'Product Saved as Draft' : 'Product Submitted',
        `${newProduct.name} was ${formData.status === 'Draft' ? 'saved as draft.' : 'queued for review.'}`
      )
      onClose()
      setFormData(EMPTY_FORM)
      setFiles([])
      setPreviews([])
      setVariants([])
    } catch (err) {
      toast.error('Could not add product', err?.response?.data?.message || 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  const gallery = files.map((file, i) => ({ key: file, src: previews[i] }))

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add New Product"
      description="New products go live once approved by admin — select a category from the platform's catalog."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} icon="add" disabled={isSubmitting}>
            {isSubmitting ? 'Submitting…' : formData.status === 'Draft' ? 'Save Draft' : 'Submit product for review'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-h-[65vh] overflow-y-auto admin-scroll pr-1.5">
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
                First image will be the <strong className="text-slate-700">Main Image (Cover)</strong>. At least 1 image is required.
              </p>
            </div>
            {previews.length > 0 && (
              <Badge tone="brand" size="xs">
                {previews.length} {previews.length === 1 ? 'photo' : 'photos'}
              </Badge>
            )}
          </div>

          <label className="flex items-center justify-center gap-2 cursor-pointer rounded-md border border-dashed border-border bg-surface p-2.5 text-center transition-colors hover:border-brand-400 hover:bg-brand-50/50">
            <Icon name="upload" className="h-4 w-4 text-brand-600" />
            <span className="text-xs font-medium text-slate-900">{previews.length === 0 ? 'Upload Main Image' : 'Add More Photos'}</span>
            <input type="file" accept="image/*" multiple onChange={handleFileUpload} className="hidden" />
          </label>

          {previews.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {previews.map((img, idx) => (
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
                    onClick={() => handleRemoveImage(idx)}
                    className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-slate-900/80 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-danger-600"
                    title="Remove image"
                  >
                    <Icon name="close" className="h-2.5 w-2.5" />
                  </button>
                </div>
              ))}
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
              placeholder="e.g. Organic Cotton Bedsheet (King)"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              containerClassName="sm:col-span-2"
            />
            <Input
              label="SKU Identifier"
              placeholder="e.g. ARY-BED-KNG"
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
              placeholder="Key product highlights in 1-2 lines..."
              rows={2}
              value={formData.shortDescription}
              onChange={(e) => setFormData({ ...formData, shortDescription: e.target.value })}
              containerClassName="sm:col-span-2"
            />
            <Textarea
              label="Description (Optional)"
              placeholder="Detailed features, material and packaging details..."
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
              placeholder="1799"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              required
            />
            <Input
              label="MRP (₹, Optional)"
              type="number"
              placeholder="2499"
              value={formData.mrp}
              onChange={(e) => setFormData({ ...formData, mrp: e.target.value })}
            />
            <Input
              label="Cost Price (₹, Optional)"
              type="number"
              placeholder="1100"
              value={formData.costPrice}
              onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
            />
            <Select
              label="Tax / GST (Optional)"
              options={GST_RATE_OPTIONS}
              value={formData.gstRate}
              onChange={(e) => setFormData({ ...formData, gstRate: e.target.value })}
            />
            <GstTypeField
              id="vp-gst-type"
              inclusive={formData.gstInclusive}
              onChange={(value) => setFormData((prev) => ({ ...prev, gstInclusive: value }))}
              price={formData.price}
              gstRate={formData.gstRate}
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
              placeholder="100"
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
              { id: 'Active', label: 'Active (Publish)' },
              { id: 'Draft', label: 'Draft' },
              { id: 'Inactive', label: 'Inactive' },
            ]}
            activeId={formData.status}
            onChange={(id) => setFormData({ ...formData, status: id })}
          />
          <p className="text-2xs text-ink-subtle">
            {formData.status === 'Active' && 'Active products will be submitted for admin review and made live once approved.'}
            {formData.status === 'Draft' && 'Draft products remain saved as unpublished drafts.'}
            {formData.status === 'Inactive' && 'Inactive products remain disabled.'}
          </p>
        </div>

        {/* SECTION 7: VARIANTS */}
        <ProductVariantsSection variants={variants} onChange={setVariants} gallery={gallery} />

        {/* FEATURED / SPOTLIGHT TOGGLES */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-amber-200/90 bg-gradient-to-r from-amber-50/80 to-orange-50/30 p-3.5 transition-all">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                id="vendor-add-flashsale"
                checked={formData.isFlashsale}
                onChange={(e) => setFormData({ ...formData, isFlashsale: e.target.checked })}
                className="mt-0.5 h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
              />
              <div className="flex-1">
                <span className="text-xs font-bold text-slate-900">🔥 Flash Sale Deal</span>
                <p className="mt-0.5 text-2xs text-slate-600">
                  Highlight in countdown deals and urgent flash promotions.
                </p>
              </div>
            </label>
          </div>

          <div className="rounded-xl border border-indigo-200/90 bg-gradient-to-r from-indigo-50/80 to-purple-50/30 p-3.5 transition-all">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                id="vendor-add-trending"
                checked={formData.isTrending}
                onChange={(e) => setFormData({ ...formData, isTrending: e.target.checked })}
                className="mt-0.5 h-4 w-4 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500"
              />
              <div className="flex-1">
                <span className="text-xs font-bold text-slate-900">📈 Trending Product</span>
                <p className="mt-0.5 text-2xs text-slate-600">
                  Showcase on trending carousels and top recommendation feeds.
                </p>
              </div>
            </label>
          </div>

          <div className="rounded-xl border border-emerald-200/90 bg-gradient-to-r from-emerald-50/80 to-teal-50/30 p-3.5 transition-all">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                id="vendor-add-returnable"
                checked={formData.isReturnable}
                onChange={(e) => setFormData({ ...formData, isReturnable: e.target.checked })}
                className="mt-0.5 h-4 w-4 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500"
              />
              <div className="flex-1">
                <span className="text-xs font-bold text-slate-900">↩️ Returnable Product</span>
                <p className="mt-0.5 text-2xs text-slate-600">
                  When on, buyers can request a return or replacement within 7 days of delivery. Turn off for non-returnable items.
                </p>
              </div>
            </label>
          </div>
        </div>
      </form>
    </Modal>
  )
}
