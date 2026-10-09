import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { GstTypeField } from '../../../../components/catalog/ProductAdvancedFields'
import { Button, Input, Modal, Select, Textarea } from '../../../../components/ui'
import { InlineAlert } from '../../../../components/admin/feedback'
import { toast } from '../../../../lib/toast'
import { api } from '../../../../lib/axios'
import { ProductVariantsSection } from '../../../../components/catalog/ProductVariantsSection'
import { buildVariantsPayload, variantFromProduct } from '../../../../components/catalog/productVariants'
import { appendImage, pickImages } from '../../../../components/catalog/pickImages'
import { GST_RATE_OPTIONS, ImagesSection, ReturnableCard, Section, StatusSection, Strong } from '../../../../components/catalog/productFormParts'

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
    gstInclusive: product.gstInclusive !== false,
    stock: product.stock != null ? String(product.stock) : '0',
    lowStockThreshold: product.lowStockThreshold != null ? String(product.lowStockThreshold) : '',
    weight: product.weight != null ? String(product.weight) : '',
    status: product.status || (product.isActive === false ? 'Inactive' : 'Active'),
    isReturnable: product.isReturnable !== false,
  }
}

export function EditVendorProductModal({ isOpen, onClose, product, onEditProduct }) {
  const [formData, setFormData] = useState(() => (product ? formFromProduct(product) : null))
  const [existingImages, setExistingImages] = useState(product?.images || [])
  const [removedImages, setRemovedImages] = useState([])
  // New photos are { uri, name, type } objects (the web's File objects); `uri` is also the preview.
  const [newFiles, setNewFiles] = useState([])
  const [categories, setCategories] = useState([])
  const [brands, setBrands] = useState([])
  const [variants, setVariants] = useState(() => (product?.variants ?? []).map((v) => variantFromProduct(v, product.price)))
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!isOpen || !product) return
    api.get('/vendor/catalog/categories').then(({ data }) => setCategories(data.data.items.filter((c) => c.approvalStatus === 'APPROVED'))).catch(() => {})
    api.get('/vendor/catalog/brands').then(({ data }) => setBrands(data.data.items.filter((b) => b.approvalStatus === 'APPROVED'))).catch(() => {})
  }, [isOpen, product])

  if (!isOpen || !product || !formData) return null

  async function handleFileUpload() {
    const selected = await pickImages({ multiple: true })
    if (!selected.length) return
    setNewFiles((prev) => [...prev, ...selected])
  }

  // A variant pointing at a removed photo would point at nothing.
  function clearVariantImage(key) {
    setVariants((prev) => prev.map((v) => (v.image === key ? { ...v, image: null } : v)))
  }

  function handleRemoveNewImage(index) {
    clearVariantImage(newFiles[index])
    setNewFiles((prev) => prev.filter((_, i) => i !== index))
  }

  function handleRemoveExistingImage(url) {
    clearVariantImage(url)
    setExistingImages((prev) => prev.filter((img) => img !== url))
    setRemovedImages((prev) => [...prev, url])
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
    if (existingImages.length === 0 && newFiles.length === 0) {
      toast.error('Missing Main Image', 'Main image is required. Please keep or upload at least one image.')
      return
    }
    const variantResult = buildVariantsPayload(variants, { galleryFiles: newFiles })
    if (variantResult.error) {
      toast.error('Check your variants', variantResult.error)
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
    body.append('gstInclusive', formData.gstInclusive === false ? 'false' : 'true')
    body.append('stock', formData.stock || '0')
    if (formData.lowStockThreshold) body.append('lowStockThreshold', formData.lowStockThreshold)
    body.append('weight', formData.weight)
    body.append('status', formData.status || 'Active')
    body.append('isReturnable', String(formData.isReturnable))

    // Always sent, empty included: an empty list is the seller removing every
    // variant, which the server only does when the field is present.
    body.append('variants', JSON.stringify(variantResult.variants))

    if (removedImages.length > 0) body.append('removeImages', JSON.stringify(removedImages))
    newFiles.forEach((f) => appendImage(body, 'images', f))

    setIsSubmitting(true)
    try {
      await onEditProduct({ id: product.id, formData: body })
      toast.success('Product Updated', `${formData.name.trim()} was saved.`)
      onClose()
    } catch (err) {
      toast.error('Could not update product', err?.response?.data?.message || err?.message || 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  const set = (key) => (e) => setFormData((prev) => ({ ...prev, [key]: e.target.value }))
  const totalImages = existingImages.length + newFiles.length
  const gallery = [
    ...existingImages.map((url) => ({ key: url, src: url })),
    ...newFiles.map((file) => ({ key: file, src: file.uri })),
  ]

  const imageItems = [
    ...existingImages.map((img, idx) => ({
      key: img,
      src: img,
      kind: idx === 0 ? 'main' : 'gallery',
      onRemove: () => handleRemoveExistingImage(img),
    })),
    ...newFiles.map((file, idx) => ({
      key: file,
      src: file.uri,
      kind: existingImages.length === 0 && idx === 0 ? 'main' : 'new',
      isNewUpload: true,
      onRemove: () => handleRemoveNewImage(idx),
    })),
  ]

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Product"
      description="Changes go live immediately on an approved product — a pending or rejected one stays under review."
      footer={
        <>
          <Button variant="secondary" onPress={onClose}>
            Cancel
          </Button>
          <Button onPress={handleSubmit} icon="save" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Save changes'}
          </Button>
        </>
      }
    >
      <View style={{ gap: 16 }}>
        {product.approvalStatus === 'REJECTED' ? (
          <InlineAlert tone="danger" title="This listing was rejected">
            {`${product.rejectionReason || 'No reason was given.'} Fix the issue below and save — it stays rejected until you resubmit it.`}
          </InlineAlert>
        ) : null}
        {product.approvalStatus === 'PENDING' ? (
          <InlineAlert tone="info" title="Still awaiting admin approval">
            Edits here update the same pending listing — they don&apos;t restart the review queue.
          </InlineAlert>
        ) : null}

        {/* SECTION 1: IMAGES */}
        <ImagesSection
          note={
            <>
              First image is the <Strong>Main Cover Image</Strong>. At least 1 image is required.
            </>
          }
          count={totalImages}
          addLabel="Add More Image Files"
          onAdd={handleFileUpload}
          items={imageItems}
        />

        {/* SECTION 2: BASIC */}
        <Section step={2} title="Basic Details">
          <View style={{ gap: 12 }}>
            <Input label="Product Name" value={formData.name} onChange={set('name')} required />
            <Input label="SKU Identifier" value={formData.sku} onChange={set('sku')} required />
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
            <Textarea
              label="Short Description (Optional)"
              placeholder="Quick highlight in 1-2 lines..."
              rows={2}
              value={formData.shortDescription}
              onChange={set('shortDescription')}
            />
            <Textarea
              label="Description (Optional)"
              placeholder="Detailed specifications, features and material..."
              rows={3}
              value={formData.description}
              onChange={set('description')}
            />
          </View>
        </Section>

        {/* SECTION 3: PRICING */}
        <Section step={3} title="Pricing & Tax">
          <View style={{ gap: 12 }}>
            <Input label="Selling Price (₹)" type="number" value={formData.price} onChange={set('price')} required />
            <Input label="MRP (₹, Optional)" type="number" placeholder="e.g. 2499" value={formData.mrp} onChange={set('mrp')} />
            <Input label="Cost Price (₹, Optional)" type="number" placeholder="e.g. 1100" value={formData.costPrice} onChange={set('costPrice')} />
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
            <Input label="Stock Quantity" type="number" keyboardType="number-pad" value={formData.stock} onChange={set('stock')} required />
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
          activeLabel="Active (Live)"
          activeNote="Active products are visible and purchasable across the store once approved."
        />

        {/* SECTION 7: VARIANTS */}
        <ProductVariantsSection variants={variants} onChange={setVariants} gallery={gallery} />

        {/* Flash Sale / Trending placement is set by admin, not the seller. */}
        <ReturnableCard checked={formData.isReturnable} onChange={(value) => setFormData((prev) => ({ ...prev, isReturnable: value }))} />
      </View>
    </Modal>
  )
}
