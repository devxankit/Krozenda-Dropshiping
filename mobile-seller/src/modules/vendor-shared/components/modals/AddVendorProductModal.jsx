import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { GstTypeField } from '../../../../components/catalog/ProductAdvancedFields'
import { Button, Input, Modal, Select, Textarea } from '../../../../components/ui'
import { toast } from '../../../../lib/toast'
import { api } from '../../../../lib/axios'
import { ProductVariantsSection } from '../../../../components/catalog/ProductVariantsSection'
import { buildVariantsPayload } from '../../../../components/catalog/productVariants'
import { appendImage, pickImages } from '../../../../components/catalog/pickImages'
import { GST_RATE_OPTIONS, ImagesSection, ReturnableCard, Section, StatusSection, Strong } from '../../../../components/catalog/productFormParts'

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
  isReturnable: true,
}

export function AddVendorProductModal({ isOpen, onClose, onAddProduct }) {
  const [formData, setFormData] = useState(EMPTY_FORM)
  // Picked photos are { uri, name, type } objects (the web's File objects); `uri` is also the preview.
  const [files, setFiles] = useState([])
  const [categories, setCategories] = useState([])
  const [brands, setBrands] = useState([])
  const [variants, setVariants] = useState([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    api.get('/vendor/catalog/categories').then(({ data }) => setCategories(data.data.items.filter((c) => c.approvalStatus !== 'PENDING' && c.approvalStatus !== 'REJECTED'))).catch(() => {})
    api.get('/vendor/catalog/brands').then(({ data }) => setBrands(data.data.items.filter((b) => b.approvalStatus !== 'PENDING' && b.approvalStatus !== 'REJECTED'))).catch(() => {})
  }, [isOpen])

  async function handleFileUpload() {
    const selected = await pickImages({ multiple: true })
    if (!selected.length) return
    setFiles((prev) => [...prev, ...selected])
  }

  function handleRemoveImage(index) {
    // A variant pointing at the removed photo would point at nothing.
    setVariants((prev) => prev.map((v) => (v.image === files[index] ? { ...v, image: null } : v)))
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit() {
    if (isSubmitting) return

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
    body.append('isReturnable', String(formData.isReturnable))

    if (variantResult.variants.length > 0) body.append('variants', JSON.stringify(variantResult.variants))

    files.forEach((f) => appendImage(body, 'images', f))

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
      setVariants([])
    } catch (err) {
      toast.error('Could not add product', err?.response?.data?.message || err?.message || 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  const set = (key) => (e) => setFormData((prev) => ({ ...prev, [key]: e.target.value }))
  const gallery = files.map((file) => ({ key: file, src: file.uri }))

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add New Product"
      description="New products go live once approved by admin — select a category from the platform's catalog."
      footer={
        <>
          <Button variant="secondary" onPress={onClose}>
            Cancel
          </Button>
          <Button onPress={handleSubmit} icon="add" disabled={isSubmitting}>
            {isSubmitting ? 'Submitting…' : formData.status === 'Draft' ? 'Save Draft' : 'Submit product for review'}
          </Button>
        </>
      }
    >
      <View style={{ gap: 16 }}>
        {/* SECTION 1: IMAGES */}
        <ImagesSection
          note={
            <>
              First image will be the <Strong>Main Image (Cover)</Strong>. At least 1 image is required.
            </>
          }
          count={files.length}
          addLabel={files.length === 0 ? 'Upload Main Image' : 'Add More Photos'}
          onAdd={handleFileUpload}
          items={files.map((file, idx) => ({
            key: file,
            src: file.uri,
            kind: idx === 0 ? 'main' : 'gallery',
            onRemove: () => handleRemoveImage(idx),
          }))}
        />

        {/* SECTION 2: BASIC */}
        <Section step={2} title="Basic Details">
          <View style={{ gap: 12 }}>
            <Input label="Product Name" placeholder="e.g. Organic Cotton Bedsheet (King)" value={formData.name} onChange={set('name')} required />
            <View style={{ gap: 12 }}>
              <Input label="SKU Identifier" placeholder="e.g. ARY-BED-KNG" value={formData.sku} onChange={set('sku')} required />
              <Select
                label="Category"
                value={formData.category}
                onChange={set('category')}
                options={categories.map((c) => ({ value: c.id, label: c.name }))}
                placeholder="Select category"
                required
              />
              <Select
                label="Brand (Optional)"
                value={formData.brand}
                onChange={set('brand')}
                options={brands.map((b) => ({ value: b.id, label: b.name }))}
                placeholder="No brand"
              />
            </View>
            <Textarea
              label="Short Description (Optional)"
              placeholder="Key product highlights in 1-2 lines..."
              rows={2}
              value={formData.shortDescription}
              onChange={set('shortDescription')}
            />
            <Textarea
              label="Description (Optional)"
              placeholder="Detailed features, material and packaging details..."
              rows={3}
              value={formData.description}
              onChange={set('description')}
            />
          </View>
        </Section>

        {/* SECTION 3: PRICING */}
        <Section step={3} title="Pricing & Tax">
          <View style={{ gap: 12 }}>
            <Input label="Selling Price (₹)" type="number" placeholder="1799" value={formData.price} onChange={set('price')} required />
            <Input label="MRP (₹, Optional)" type="number" placeholder="2499" value={formData.mrp} onChange={set('mrp')} />
            <Input label="Cost Price (₹, Optional)" type="number" placeholder="1100" value={formData.costPrice} onChange={set('costPrice')} />
            <Select label="Tax / GST (Optional)" options={GST_RATE_OPTIONS} value={formData.gstRate} onChange={set('gstRate')} />
            <GstTypeField
              inclusive={formData.gstInclusive}
              onChange={(value) => setFormData((prev) => ({ ...prev, gstInclusive: value }))}
              price={formData.price}
              gstRate={formData.gstRate}
            />
          </View>
        </Section>

        {/* SECTION 4: INVENTORY */}
        <Section step={4} title="Inventory">
          <View style={{ gap: 12 }}>
            <Input label="Stock Quantity" type="number" keyboardType="number-pad" placeholder="100" value={formData.stock} onChange={set('stock')} required />
            <Input
              label="Low Stock Threshold (Optional)"
              type="number"
              keyboardType="number-pad"
              placeholder="10"
              value={formData.lowStockThreshold}
              onChange={set('lowStockThreshold')}
              description="Alert trigger when inventory falls below this"
            />
          </View>
        </Section>

        {/* SECTION 5: SHIPPING */}
        <Section step={5} title="Shipping">
          <Input
            label="Weight (kg)"
            type="number"
            placeholder="0.45"
            value={formData.weight}
            onChange={set('weight')}
            description="Package shipping weight in kilograms used for courier calculation"
            required
          />
        </Section>

        {/* SECTION 6: PRODUCT STATUS */}
        <StatusSection
          status={formData.status}
          onChange={(id) => setFormData((prev) => ({ ...prev, status: id }))}
          activeLabel="Active (Publish)"
          activeNote="Active products will be submitted for admin review and made live once approved."
        />

        {/* SECTION 7: VARIANTS */}
        <ProductVariantsSection variants={variants} onChange={setVariants} gallery={gallery} />

        {/* Flash Sale / Trending placement is set by admin, not the seller. */}
        <ReturnableCard checked={formData.isReturnable} onChange={(value) => setFormData((prev) => ({ ...prev, isReturnable: value }))} />
      </View>
    </Modal>
  )
}
