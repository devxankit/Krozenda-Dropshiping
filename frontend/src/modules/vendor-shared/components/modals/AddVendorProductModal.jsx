import { useState } from 'react'
import { Badge, Button, Icon, Input, Modal, Select, Textarea } from '../../../../components/ui'
import { toast } from '../../../admin/stores/toastStore'

export function AddVendorProductModal({ isOpen, onClose, onAddProduct }) {
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    category: 'Home & Living',
    costPrice: '',
    sellingPrice: '',
    b2bPrice: '',
    stock: '100',
    moq: '1',
    description: '',
  })
  const [images, setImages] = useState([])
  const [imageUrlInput, setImageUrlInput] = useState('')

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return

    files.forEach((file) => {
      const reader = new FileReader()
      reader.onload = (event) => {
        setImages((prev) => [...prev, event.target.result])
      }
      reader.readAsDataURL(file)
    })
  }

  const handleAddUrlImage = () => {
    if (!imageUrlInput.trim()) return
    setImages((prev) => [...prev, imageUrlInput.trim()])
    setImageUrlInput('')
  }

  const handleRemoveImage = (index) => {
    setImages((prev) => prev.filter((_, i) => i !== index))
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!formData.name || !formData.sku || !formData.sellingPrice) {
      toast.error('Missing Required Fields', 'Please fill in product title, SKU and selling price.')
      return
    }

    const costNum = Math.round(parseFloat(formData.costPrice || formData.sellingPrice * 0.7) * 100)
    const sellingNum = Math.round(parseFloat(formData.sellingPrice) * 100)
    const b2bNum = Math.round(parseFloat(formData.b2bPrice || formData.sellingPrice * 0.85) * 100)
    const marginPct = sellingNum > costNum ? parseFloat((((sellingNum - costNum) / sellingNum) * 100).toFixed(1)) : 25.0

    const newProduct = {
      id: `vp-${Math.floor(1000 + Math.random() * 9000)}`,
      sku: formData.sku.toUpperCase(),
      name: formData.name,
      category: formData.category,
      imageUrl: images[0] || 'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?w=300',
      images,
      costPrice: costNum,
      sellingPrice: sellingNum,
      b2bPrice: b2bNum,
      marginPct,
      stock: parseInt(formData.stock, 10) || 0,
      moq: parseInt(formData.moq, 10) || 1,
      status: 'pending_approval',
      updatedAt: 'Just now',
    }

    onAddProduct?.(newProduct)
    toast.success(
      'Product Submitted for Review',
      `${formData.name} added to catalog and queued for Admin approval.`,
    )
    onClose()
    setFormData({
      name: '',
      sku: '',
      category: 'Home & Living',
      costPrice: '',
      sellingPrice: '',
      b2bPrice: '',
      stock: '100',
      moq: '1',
      description: '',
    })
    setImages([])
    setImageUrlInput('')
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add New Vendor Product"
      description="Upload product photos, set SKU prices, wholesale B2B pricing, and initial stock."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} icon="add">
            Submit product for review
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 max-h-[60vh] overflow-y-auto admin-scroll pr-1.5">
        {/* Product Images Section */}
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface-subtle p-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-semibold text-slate-900">Product Photos</h4>
              <p className="text-2xs text-ink-subtle">
                First uploaded image will be primary catalog thumbnail.
              </p>
            </div>
            {images.length > 0 && (
              <Badge tone="brand" size="xs">
                {images.length} {images.length === 1 ? 'photo' : 'photos'}
              </Badge>
            )}
          </div>

          {/* File Upload Zone + URL Paste */}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <label className="flex items-center justify-center gap-2 cursor-pointer rounded-md border border-dashed border-border bg-surface p-2.5 text-center transition-colors hover:border-brand-400 hover:bg-brand-50/50">
              <Icon name="upload" className="h-4 w-4 text-brand-600" />
              <span className="text-xs font-medium text-slate-900">Choose Image Files</span>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>

            <div className="flex items-center gap-2 rounded-md border border-border bg-surface px-2.5 py-1">
              <Input
                placeholder="Paste image URL..."
                value={imageUrlInput}
                onChange={(e) => setImageUrlInput(e.target.value)}
                className="text-xs border-0 shadow-none focus:ring-0 p-0"
              />
              <Button type="button" size="xs" variant="secondary" onClick={handleAddUrlImage}>
                Add
              </Button>
            </div>
          </div>

          {/* Image Thumbnails Gallery */}
          {images.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {images.map((img, idx) => (
                <div
                  key={idx}
                  className="relative group h-14 w-14 overflow-hidden rounded-md border border-border bg-surface shadow-2xs"
                >
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

        {/* Basic Product Info */}
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Product Title"
            placeholder="e.g. Organic Cotton Bedsheet (King)"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <Input
            label="Stock Keeping Unit (SKU)"
            placeholder="e.g. ARY-BED-KNG"
            value={formData.sku}
            onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
            required
          />
        </div>

        {/* Category & Pricing */}
        <div className="grid gap-3 sm:grid-cols-3">
          <Select
            label="Category"
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            options={[
              { value: 'Home & Living', label: 'Home & Living' },
              { value: 'Kitchenware', label: 'Kitchenware' },
              { value: 'Electronics', label: 'Electronics' },
              { value: 'Gourmet & Spices', label: 'Gourmet & Spices' },
              { value: 'Home & Decor', label: 'Home & Decor' },
            ]}
          />
          <Input
            label="Base Cost Price (₹)"
            type="number"
            placeholder="1250"
            value={formData.costPrice}
            onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
          />
          <Input
            label="Retail Price (₹)"
            type="number"
            placeholder="1799"
            value={formData.sellingPrice}
            onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
            required
          />
        </div>

        {/* B2B Tier & Inventory */}
        <div className="grid gap-3 sm:grid-cols-3">
          <Input
            label="B2B Wholesale Price (₹)"
            type="number"
            placeholder="1450"
            value={formData.b2bPrice}
            onChange={(e) => setFormData({ ...formData, b2bPrice: e.target.value })}
          />
          <Input
            label="Initial Stock Quantity"
            type="number"
            placeholder="100"
            value={formData.stock}
            onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
          />
          <Input
            label="Minimum Order Qty (MOQ)"
            type="number"
            placeholder="1"
            value={formData.moq}
            onChange={(e) => setFormData({ ...formData, moq: e.target.value })}
          />
        </div>

        {/* Description */}
        <Textarea
          label="Product Description / Specifications"
          placeholder="Enter product features, dimensions, material and packaging details..."
          rows={2}
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
        />
      </form>
    </Modal>
  )
}
