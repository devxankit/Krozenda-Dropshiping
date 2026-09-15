import { useEffect, useState } from 'react'
import { Badge, Button, Icon, Input, Modal, Select, Textarea } from '../../../../components/ui'
import { toast } from '../../../admin/stores/toastStore'
import { api } from '../../../../lib/axios'

const EMPTY_FORM = { name: '', sku: '', category: '', brand: '', price: '', salePrice: '', stock: '100', description: '' }

// A seller only picks from the admin-created catalog — no ad-hoc category/
// brand creation here (per platform rule: sellers get product CRUD, not
// taxonomy CRUD) — so this loads the real, live lists from the public
// catalog endpoints rather than a hand-authored dropdown.
export function AddVendorProductModal({ isOpen, onClose, onAddProduct }) {
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [files, setFiles] = useState([])
  const [previews, setPreviews] = useState([])
  const [categories, setCategories] = useState([])
  const [brands, setBrands] = useState([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    // Only APPROVED entries are selectable — a category/brand the seller just
    // proposed isn't usable for a product until admin approves it (see
    // CategoriesPage for where that pending status is tracked).
    api.get('/vendor/catalog/categories').then(({ data }) => setCategories(data.data.items.filter((c) => c.approvalStatus === 'APPROVED'))).catch(() => {})
    api.get('/vendor/catalog/brands').then(({ data }) => setBrands(data.data.items.filter((b) => b.approvalStatus === 'APPROVED'))).catch(() => {})
  }, [isOpen])

  function handleFileUpload(e) {
    const selected = Array.from(e.target.files || [])
    if (!selected.length) return
    setFiles((prev) => [...prev, ...selected])
    setPreviews((prev) => [...prev, ...selected.map((f) => URL.createObjectURL(f))])
  }

  function handleRemoveImage(index) {
    setFiles((prev) => prev.filter((_, i) => i !== index))
    setPreviews((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!formData.name.trim() || !formData.category || !formData.price) {
      toast.error('Missing Required Fields', 'Please fill in product title, category and price.')
      return
    }

    const body = new FormData()
    body.append('name', formData.name.trim())
    if (formData.sku.trim()) body.append('sku', formData.sku.trim())
    body.append('category', formData.category)
    if (formData.brand) body.append('brand', formData.brand)
    body.append('price', formData.price)
    if (formData.salePrice) body.append('salePrice', formData.salePrice)
    body.append('stock', formData.stock || '0')
    body.append('description', formData.description)
    files.forEach((f) => body.append('images', f))

    setIsSubmitting(true)
    try {
      const newProduct = await onAddProduct(body)
      toast.success('Product Submitted for Review', `${newProduct.name} was queued for admin approval.`)
      onClose()
      setFormData(EMPTY_FORM)
      setFiles([])
      setPreviews([])
    } catch (err) {
      toast.error('Could not add product', err?.response?.data?.message || 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add New Product"
      description="New products go live only after admin approval — pick a category from the platform's catalog."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} icon="add" disabled={isSubmitting}>
            {isSubmitting ? 'Submitting…' : 'Submit product for review'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 max-h-[60vh] overflow-y-auto admin-scroll pr-1.5">
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface-subtle p-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-semibold text-slate-900">Product Photos</h4>
              <p className="text-2xs text-ink-subtle">First uploaded image will be the primary thumbnail.</p>
            </div>
            {previews.length > 0 && (
              <Badge tone="brand" size="xs">
                {previews.length} {previews.length === 1 ? 'photo' : 'photos'}
              </Badge>
            )}
          </div>

          <label className="flex items-center justify-center gap-2 cursor-pointer rounded-md border border-dashed border-border bg-surface p-2.5 text-center transition-colors hover:border-brand-400 hover:bg-brand-50/50">
            <Icon name="upload" className="h-4 w-4 text-brand-600" />
            <span className="text-xs font-medium text-slate-900">Choose Image Files</span>
            <input type="file" accept="image/*" multiple onChange={handleFileUpload} className="hidden" />
          </label>

          {previews.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {previews.map((img, idx) => (
                <div key={img} className="relative group h-14 w-14 overflow-hidden rounded-md border border-border bg-surface shadow-2xs">
                  <img src={img} alt={`Product thumbnail ${idx + 1}`} className="h-full w-full object-cover" />
                  {idx === 0 && (
                    <span className="absolute left-0.5 top-0.5 rounded bg-brand-600 px-1 py-0.2 text-[8px] font-bold text-white shadow-2xs">
                      Main
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

        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Product Title"
            placeholder="e.g. Organic Cotton Bedsheet (King)"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <Input
            label="SKU (optional)"
            placeholder="e.g. ARY-BED-KNG"
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
            placeholder="1799"
            value={formData.price}
            onChange={(e) => setFormData({ ...formData, price: e.target.value })}
            required
          />
          <Input
            label="Sale Price (₹, optional)"
            type="number"
            placeholder="1499"
            value={formData.salePrice}
            onChange={(e) => setFormData({ ...formData, salePrice: e.target.value })}
          />
          <Input
            label="Initial Stock"
            type="number"
            placeholder="100"
            value={formData.stock}
            onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
          />
        </div>

        <Textarea
          label="Description"
          placeholder="Enter product features, dimensions, material and packaging details..."
          rows={2}
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
        />
      </form>
    </Modal>
  )
}
