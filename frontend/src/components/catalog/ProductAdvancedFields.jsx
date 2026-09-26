import { useState } from 'react'
import { Badge, Button, Icon, Input, Select } from '../ui'

// The GST slabs that exist in India, matching GST_SLABS in
// backend/Controllers/vendorProductController.js. A rate outside this list is
// refused by the server, so offering a free-text box here would only invite a
// round trip to be told no.
const GST_OPTIONS = [
  { value: '', label: 'Not classified' },
  { value: '0', label: '0% — exempt' },
  { value: '5', label: '5%' },
  { value: '12', label: '12%' },
  { value: '18', label: '18%' },
  { value: '28', label: '28%' },
]

// Shared by the seller panel's Add Product modal and the admin panel's
// Product drawer, so the two cannot drift on what a valid GST rate or a
// valid quantity break looks like.
//
// Everything below the fold on the product form. Collapsed by default because
// a seller listing a simple retail item needs none of it, and an eight-section
// form is how a three-field product stops getting listed at all.
export function CollapsibleSection({ title, description, badge, defaultOpen = false, children }) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="rounded-lg border border-border">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-surface-muted"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-900">{title}</span>
            {badge && (
              <Badge tone="brand" size="sm">
                {badge}
              </Badge>
            )}
          </div>
          {description && <p className="mt-0.5 text-2xs text-ink-subtle">{description}</p>}
        </div>
        <Icon name={isOpen ? 'chevronUp' : 'chevronDown'} className="h-4 w-4 shrink-0 text-ink-subtle" />
      </button>

      {isOpen && <div className="border-t border-border p-3">{children}</div>}
    </div>
  )
}

// Weight and dimensions. Not cosmetic: shipping rates are quoted on
// max(actual, volumetric) weight, so a product with neither falls back to the
// seller's default package and gets priced on a guess.
export function ShippingFields({ value, onChange }) {
  const set = (key) => (e) => onChange({ ...value, [key]: e.target.value })
  const dims = value.dimensions || {}
  const setDim = (key) => (e) => onChange({ ...value, dimensions: { ...dims, [key]: e.target.value } })

  const partial =
    [dims.lengthCm, dims.breadthCm, dims.heightCm].some(Boolean) &&
    ![dims.lengthCm, dims.breadthCm, dims.heightCm].every(Boolean)

  return (
    <div className="flex flex-col gap-3">
      <Input
        id="vp-weight"
        label="Weight (kg)"
        type="number"
        step="0.01"
        placeholder="0.5"
        value={value.weight || ''}
        onChange={set('weight')}
        description="Used to quote shipping. Left blank, your default package is used instead."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Input id="vp-length" label="Length (cm)" type="number" step="0.1" value={dims.lengthCm || ''} onChange={setDim('lengthCm')} />
        <Input id="vp-breadth" label="Breadth (cm)" type="number" step="0.1" value={dims.breadthCm || ''} onChange={setDim('breadthCm')} />
        <Input id="vp-height" label="Height (cm)" type="number" step="0.1" value={dims.heightCm || ''} onChange={setDim('heightCm')} />
      </div>

      {partial && (
        <p className="text-2xs text-warning-700">
          Enter all three dimensions or none — a partial set cannot produce a volumetric weight and will be ignored.
        </p>
      )}
    </div>
  )
}

const GST_TYPE_OPTIONS = [
  { value: 'inclusive', label: 'Inclusive — price already includes GST' },
  { value: 'exclusive', label: 'Exclusive — GST added on top at checkout' },
]

// Whether the price entered already contains GST. Shared by the admin product
// form and both seller product modals, with a one-line preview of what the
// buyer will actually pay so the choice is never abstract.
export function GstTypeField({ id = 'product-gst-type', inclusive, onChange, price, gstRate }) {
  const rate = gstRate === '' || gstRate === null || gstRate === undefined ? null : Number(gstRate)
  const amount = Number(price) || 0
  const fmt = (n) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

  let preview = null
  if (amount > 0 && rate === null) {
    preview = 'No GST rate chosen — the platform default rate set by admin will apply.'
  } else if (amount > 0 && rate === 0) {
    preview = `Buyer pays ${fmt(amount)} (no GST).`
  } else if (amount > 0) {
    if (inclusive) {
      const taxable = Math.round((amount / (1 + rate / 100)) * 100) / 100
      preview = `Buyer pays ${fmt(amount)} — includes ${fmt(Math.round((amount - taxable) * 100) / 100)} GST (${rate}%).`
    } else {
      const tax = Math.round(amount * rate) / 100
      preview = `Buyer pays ${fmt(Math.round((amount + tax) * 100) / 100)} — ${fmt(amount)} + ${fmt(tax)} GST (${rate}%).`
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Select
        id={id}
        label="GST Type"
        options={GST_TYPE_OPTIONS}
        value={inclusive === false ? 'exclusive' : 'inclusive'}
        onChange={(e) => onChange(e.target.value !== 'exclusive')}
      />
      {preview && <p className="text-2xs font-medium text-ink-muted">{preview}</p>}
    </div>
  )
}

export function TaxFields({ value, onChange }) {
  const set = (key) => (e) => onChange({ ...value, [key]: e.target.value })

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Input
        id="vp-hsn"
        label="HSN code"
        placeholder="6109"
        value={value.hsnCode || ''}
        onChange={set('hsnCode')}
        description="4 to 8 digits. Required on a GST invoice."
      />
      <Select
        id="vp-gst"
        label="GST rate"
        options={GST_OPTIONS}
        value={value.gstRate ?? ''}
        onChange={set('gstRate')}
        description="Prices you enter are treated as GST-inclusive."
      />
    </div>
  )
}

// Quantity breaks. The whole B2B story on this platform: a dealer buying 100
// pays a different unit price from a retail buyer buying one, out of the same
// catalog entry.
export function PriceTierEditor({ tiers, onChange, basePrice }) {
  function update(index, key, raw) {
    const next = tiers.map((t, i) => (i === index ? { ...t, [key]: raw } : t))
    onChange(next)
  }

  function add() {
    // Seeded above the last break so the list stays ascending as it is built.
    const lastQty = tiers.length > 0 ? Number(tiers[tiers.length - 1].minQty) || 0 : 1
    onChange([...tiers, { minQty: String(lastQty + 9), price: '' }])
  }

  const base = Number(basePrice) || 0
  const tooHigh = tiers.filter((t) => base > 0 && Number(t.price) >= base)

  return (
    <div className="flex flex-col gap-2.5">
      {tiers.length === 0 && (
        <p className="text-2xs text-ink-subtle">
          No bulk pricing. Add a break to charge less per unit above a quantity.
        </p>
      )}

      {tiers.map((tier, index) => (
        <div key={index} className="flex items-end gap-2">
          <Input
            id={`vp-tier-qty-${index}`}
            label={index === 0 ? 'Buy at least' : undefined}
            type="number"
            min="2"
            placeholder="10"
            value={tier.minQty}
            onChange={(e) => update(index, 'minQty', e.target.value)}
            containerClassName="flex-1"
          />
          <Input
            id={`vp-tier-price-${index}`}
            label={index === 0 ? 'Unit price (₹)' : undefined}
            type="number"
            step="0.01"
            placeholder="80"
            value={tier.price}
            onChange={(e) => update(index, 'price', e.target.value)}
            containerClassName="flex-1"
          />
          <Button
            type="button"
            variant="quiet"
            size="control"
            iconOnly
            icon="delete"
            aria-label={`Remove quantity break ${index + 1}`}
            onClick={() => onChange(tiers.filter((_, i) => i !== index))}
          />
        </div>
      ))}

      <Button type="button" variant="secondary" size="sm" icon="add" onClick={add} className="self-start">
        Add a quantity break
      </Button>

      {tooHigh.length > 0 && (
        <p className="text-2xs text-warning-700">
          A break priced at or above your regular price never applies — buyers are never charged more for buying more.
        </p>
      )}
    </div>
  )
}

// Variants. Once a product has one, the product itself stops being buyable —
// the buyer must choose an option, and each option carries its own price and
// stock. The copy says so, because that is a real change in how the product
// behaves and a seller should not discover it from a cart error.
export function VariantEditor({ variants, onChange }) {
  function update(index, key, raw) {
    onChange(variants.map((v, i) => (i === index ? { ...v, [key]: raw } : v)))
  }

  function add() {
    onChange([...variants, { name: '', sku: '', price: '', salePrice: '', stock: '0', isActive: true }])
  }

  return (
    <div className="flex flex-col gap-3">
      {variants.length === 0 ? (
        <p className="text-2xs text-ink-subtle">
          No options. Add one if this product comes in sizes, colours or pack sizes that differ in price or stock.
        </p>
      ) : (
        <p className="text-2xs text-warning-700">
          With options set, buyers must pick one before adding to cart, and each option sells from its own stock — the
          product-level stock above is no longer used.
        </p>
      )}

      {variants.map((variant, index) => (
        <div key={index} className="flex flex-col gap-2.5 rounded-lg border border-border bg-surface-subtle p-2.5">
          <div className="flex items-end gap-2">
            <Input
              id={`vp-variant-name-${index}`}
              label="Option name"
              placeholder="Red / L"
              value={variant.name}
              onChange={(e) => update(index, 'name', e.target.value)}
              containerClassName="flex-1"
              required
            />
            <Button
              type="button"
              variant="quiet"
              size="control"
              iconOnly
              icon="delete"
              aria-label={`Remove option ${index + 1}`}
              onClick={() => onChange(variants.filter((_, i) => i !== index))}
            />
          </div>

          <div className="grid gap-2.5 sm:grid-cols-4">
            <Input
              id={`vp-variant-sku-${index}`}
              label="SKU"
              placeholder="Optional"
              value={variant.sku}
              onChange={(e) => update(index, 'sku', e.target.value)}
            />
            <Input
              id={`vp-variant-price-${index}`}
              label="Price (₹)"
              type="number"
              placeholder="Same as product"
              value={variant.price}
              onChange={(e) => update(index, 'price', e.target.value)}
            />
            <Input
              id={`vp-variant-sale-${index}`}
              label="Sale price (₹)"
              type="number"
              placeholder="Optional"
              value={variant.salePrice}
              onChange={(e) => update(index, 'salePrice', e.target.value)}
            />
            <Input
              id={`vp-variant-stock-${index}`}
              label="Stock"
              type="number"
              min="0"
              value={variant.stock}
              onChange={(e) => update(index, 'stock', e.target.value)}
            />
          </div>
        </div>
      ))}

      <Button type="button" variant="secondary" size="sm" icon="add" onClick={add} className="self-start">
        Add an option
      </Button>
    </div>
  )
}
