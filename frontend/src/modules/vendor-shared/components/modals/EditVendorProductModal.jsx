import { useEffect, useState } from 'react'
import { Badge, Button, Icon, Input, Modal, Select, Textarea } from '../../../../components/ui'
import { InlineAlert } from '../../../admin/components/feedback'
import { toast } from '../../../admin/stores/toastStore'
import { api } from '../../../../lib/axios'
import {
  CollapsibleSection,
  PriceTierEditor,
  ShippingFields,
  TaxFields,
  VariantEditor,
} from '../../../../components/catalog/ProductAdvancedFields'
import { appendAdvancedFields } from '../../../../components/catalog/productFormPayload'

function formFromProduct(product) {
  return {
    name: product.name || '',
    sku: product.sku || '',
    category: product.category?.id || '',
    brand: product.brand?.id || '',
    price: product.price != null ? String(product.price) : '',
    salePrice: product.salePrice != null ? String(product.salePrice) : '',
    stock: product.stock != null ? String(product.stock) : '0',
    description: product.description || '',
    weight: product.weight != null ? String(product.weight) : '',
    dimensions: {
      lengthCm: product.dimensions?.lengthCm != null ? String(product.dimensions.lengthCm) : '',
      breadthCm: product.dimensions?.breadthCm != null ? String(product.dimensions.breadthCm) : '',
      heightCm: product.dimensions?.heightCm != null ? String(product.dimensions.heightCm) : '',
    },
    hsnCode: product.hsnCode || '',
    gstRate: product.gstRate != null ? String(product.gstRate) : '',
    moq: product.moq != null ? String(product.moq) : '1',
    priceTiers: (product.priceTiers || []).map((t) => ({
      minQty: String(t.minQty),
      price: String(t.price),
    })),
    variants: (product.variants || []).map((v) => ({
      id: v.id,
      name: v.name || '',
      sku: v.sku || '',
      price: v.price != null ? String(v.price) : '',
      salePrice: v.salePrice != null ? String(v.salePrice) : '',
      stock: v.stock != null ? String(v.stock) : '0',
      isActive: v.isActive !== false,
    })),
  }
}

// Editing an already-listed product. Unlike AddVendorProductModal this never
// re-submits for approval on its own — the backend only re-queues a REJECTED
// product's resubmission implicitly; a normal edit to a live/pending listing
// just updates it in place (see vendorProductController.updateMyProduct).
export function EditVendorProductModal({ isOpen, onClose, product, onEditProduct }) {
  const [formData, setFormData] = useState(() => (product ? formFromProduct(product) : null))
  const [existingImages, setExistingImages] = useState(product?.images || [])
  const [removedImages, setRemovedImages] = useState([])
  const [newFiles, setNewFiles] = useState([])
  const [newPreviews, setNewPreviews] = useState([])
  const [categories, setCategories] = useState([])
  const [brands, setBrands] = useState([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form/image state deliberately isn't re-synced here — the parent remounts
  // this component (key={product?.id}) whenever the target product changes,
  // so the useState initializers above already start fresh. This effect is
  // only for the category/brand lookups, which are a real side effect.
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
    if (!formData.name.trim() || !formData.category || !formData.price) {
      toast.error('Missing Required Fields', 'Please fill in product title, category and price.')
      return
    }

    const body = new FormData()
    body.append('name', formData.name.trim())
    body.append('sku', formData.sku.trim())
    body.append('category', formData.category)
    body.append('brand', formData.brand || '')
    body.append('price', formData.price)
    body.append('salePrice', formData.salePrice || '')
    body.append('stock', formData.stock || '0')
    body.append('description', formData.description)
    appendAdvancedFields(body, formData)
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
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 max-h-[60vh] overflow-y-auto admin-scroll pr-1.5">
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

        <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface-subtle p-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-semibold text-slate-900">Product Photos</h4>
              <p className="text-2xs text-ink-subtle">First image is the primary thumbnail.</p>
            </div>
            {(existingImages.length + newPreviews.length) > 0 && (
              <Badge tone="brand" size="xs">
                {existingImages.length + newPreviews.length} {existingImages.length + newPreviews.length === 1 ? 'photo' : 'photos'}
              </Badge>
            )}
          </div>

          <label className="flex items-center justify-center gap-2 cursor-pointer rounded-md border border-dashed border-border bg-surface p-2.5 text-center transition-colors hover:border-brand-400 hover:bg-brand-50/50">
            <Icon name="upload" className="h-4 w-4 text-brand-600" />
            <span className="text-xs font-medium text-slate-900">Add Image Files</span>
            <input type="file" accept="image/*" multiple onChange={handleFileUpload} className="hidden" />
          </label>

          {(existingImages.length > 0 || newPreviews.length > 0) && (
            <div className="flex flex-wrap gap-2 pt-1">
              {existingImages.map((img, idx) => (
                <div key={img} className="relative group h-14 w-14 overflow-hidden rounded-md border border-border bg-surface shadow-2xs">
                  <img src={img} alt={`Product thumbnail ${idx + 1}`} className="h-full w-full object-cover" />
                  {idx === 0 && (
                    <span className="absolute left-0.5 top-0.5 rounded bg-brand-600 px-1 py-0.2 text-[8px] font-bold text-white shadow-2xs">
                      Main
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
              {newPreviews.map((img, idx) => (
                <div key={img} className="relative group h-14 w-14 overflow-hidden rounded-md border border-brand-300 bg-surface shadow-2xs">
                  <img src={img} alt={`New upload ${idx + 1}`} className="h-full w-full object-cover" />
                  <span className="absolute left-0.5 top-0.5 rounded bg-emerald-600 px-1 py-0.2 text-[8px] font-bold text-white shadow-2xs">
                    New
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveNewImage(idx)}
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

        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Product Title"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <Input
            label="SKU (optional)"
            value={formData.sku}
            onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            label="Category"
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
            placeholder="Select a category"
            required
          />
          <Select
            label="Brand (optional)"
            value={formData.brand}
            onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
            options={brands.map((b) => ({ value: b.id, label: b.name }))}
            placeholder="No brand"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Input
            label="Price (₹)"
            type="number"
            value={formData.price}
            onChange={(e) => setFormData({ ...formData, price: e.target.value })}
            required
          />
          <Input
            label="Sale Price (₹, optional)"
            type="number"
            value={formData.salePrice}
            onChange={(e) => setFormData({ ...formData, salePrice: e.target.value })}
          />
          <Input
            label="Stock"
            type="number"
            value={formData.stock}
            onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
          />
        </div>

        <Textarea
          label="Description"
          rows={2}
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
        />

        <CollapsibleSection
          title="Shipping"
          description="Weight and dimensions — these decide what a courier charges."
          badge={formData.weight || formData.dimensions.lengthCm ? 'Set' : null}
        >
          <ShippingFields value={formData} onChange={setFormData} />
        </CollapsibleSection>

        <CollapsibleSection
          title="Tax"
          description="HSN code and GST rate for invoicing."
          badge={formData.hsnCode || formData.gstRate ? 'Set' : null}
        >
          <TaxFields value={formData} onChange={setFormData} />
        </CollapsibleSection>

        <CollapsibleSection
          title="Bulk & wholesale pricing"
          description="Minimum order quantity and per-unit price breaks."
          badge={formData.priceTiers.length > 0 || formData.moq !== '1' ? 'Set' : null}
        >
          <div className="flex flex-col gap-3">
            <Input
              id="ep-moq"
              label="Minimum order quantity"
              type="number"
              min="1"
              value={formData.moq}
              onChange={(e) => setFormData({ ...formData, moq: e.target.value })}
              description="1 means no minimum. Buyers cannot check out below this."
              containerClassName="sm:max-w-xs"
            />
            <PriceTierEditor
              tiers={formData.priceTiers}
              basePrice={formData.salePrice || formData.price}
              onChange={(priceTiers) => setFormData({ ...formData, priceTiers })}
            />
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          title="Options & variants"
          description="Sizes, colours or pack sizes with their own price and stock."
          badge={formData.variants.length > 0 ? `${formData.variants.length}` : null}
        >
          <VariantEditor
            variants={formData.variants}
            onChange={(variants) => setFormData({ ...formData, variants })}
          />
        </CollapsibleSection>
      </form>
    </Modal>
  )
}
