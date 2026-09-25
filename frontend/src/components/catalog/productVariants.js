// Price mapping, so this form and the storefront agree without a new field:
// the variant's stored `price` is its list price (what gets struck through)
// and `salePrice` is what the buyer pays — see backend utils/pricing. Here
// they are shown as MRP and Selling Price, which is what an admin thinks in.

export const COMMON_ATTRIBUTES = ['Color', 'Size', 'Material', 'Storage', 'RAM', 'Pack Size', 'Weight']

export function emptyVariant(seed = {}) {
  return {
    id: null,
    name: '',
    sku: '',
    attributes: [{ name: '', value: '' }],
    sellingPrice: '',
    mrp: '',
    costPrice: '',
    stock: '0',
    weight: '',
    image: null,
    isActive: true,
    ...seed,
  }
}

// `parentPrice` fills an option saved as "same as the product" (price null),
// since this form asks for an explicit selling price on every variant.
export function variantFromProduct(v, parentPrice) {
  const hasSale = v.salePrice != null
  const attributes = Object.entries(v.attributes || {}).map(([name, value]) => ({ name, value: String(value) }))
  return {
    id: v.id,
    name: v.name || '',
    sku: v.sku || '',
    attributes: attributes.length ? attributes : [{ name: '', value: '' }],
    sellingPrice: String((hasSale ? v.salePrice : v.price) ?? parentPrice ?? ''),
    mrp: hasSale && v.price != null ? String(v.price) : '',
    costPrice: v.costPrice != null ? String(v.costPrice) : '',
    stock: String(v.stock ?? 0),
    weight: v.weight != null ? String(v.weight) : '',
    image: v.image || null,
    isActive: v.isActive !== false,
  }
}

export function attributeLabel(attributes) {
  return attributes
    .map((a) => a.value.trim())
    .filter(Boolean)
    .join(' / ')
}

// Returns { variants } ready for the API, or { error } naming the first
// problem. `galleryFiles` is the list of new File objects in upload order, so
// a variant pointing at one can be sent as "new:<index>" and resolved to its
// real URL by the server once multer has written it.
export function buildVariantsPayload(variants, { galleryFiles }) {
  const out = []
  const skus = new Set()

  for (const [index, v] of variants.entries()) {
    const label = `Variant ${index + 1}`
    const attributes = {}
    for (const a of v.attributes) {
      const name = a.name.trim()
      const value = a.value.trim()
      if (!name && !value) continue
      if (!name || !value) return { error: `${label}: every attribute needs both a name and a value` }
      if (name.includes('.') || name.startsWith('$')) return { error: `${label}: attribute "${name}" cannot contain "." or start with "$"` }
      if (attributes[name] !== undefined) return { error: `${label}: attribute "${name}" is listed twice` }
      attributes[name] = value
    }

    const name = v.name.trim() || attributeLabel(v.attributes)
    if (!name) return { error: `${label}: give it a name or at least one attribute (e.g. Color: Black)` }

    // Required for new variants only: CJ-onboarded and older seller variants
    // can exist without one, and editing the product must not be blocked by that.
    const sku = v.sku.trim()
    if (!sku && !v.id) return { error: `${label} (${name}): SKU is required` }
    if (sku && skus.has(sku.toLowerCase())) return { error: `Two variants share the SKU ${sku}` }
    if (sku) skus.add(sku.toLowerCase())

    const selling = Number(v.sellingPrice)
    if (v.sellingPrice.trim() === '' || !Number.isFinite(selling) || selling <= 0) {
      return { error: `${label} (${name}): enter a selling price above ₹0` }
    }
    const mrp = v.mrp.trim() === '' ? null : Number(v.mrp)
    if (mrp !== null && mrp < selling) return { error: `${label} (${name}): MRP cannot be lower than the selling price` }

    const stock = v.stock.trim() === '' ? NaN : Number(v.stock)
    if (!Number.isInteger(stock) || stock < 0) return { error: `${label} (${name}): enter a whole stock quantity` }

    const weight = v.weight.trim() === '' ? null : Number(v.weight)
    if (weight !== null && !(weight > 0)) return { error: `${label} (${name}): weight must be greater than 0 kg` }

    let image = null
    if (v.image instanceof File) {
      const fileIndex = galleryFiles.indexOf(v.image)
      image = fileIndex === -1 ? null : `new:${fileIndex}`
    } else if (v.image) {
      image = v.image
    }

    const discounted = mrp !== null && mrp > selling
    out.push({
      ...(v.id ? { id: v.id } : {}),
      name,
      sku,
      attributes,
      price: discounted ? mrp : selling,
      salePrice: discounted ? selling : null,
      costPrice: v.costPrice.trim() === '' ? null : Number(v.costPrice),
      stock,
      weight,
      image,
      isActive: v.isActive,
    })
  }

  return { variants: out }
}
