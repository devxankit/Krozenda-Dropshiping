import { useId } from 'react'
import { Badge, Button, Checkbox, Icon, Input } from '../ui'
import { COMMON_ATTRIBUTES, attributeLabel, emptyVariant } from './productVariants'

// Options a buyer picks between — sizes, colours, pack sizes — each with its
// own price and stock. Attributes are free-form name/value pairs rather than
// fixed Color/Size columns, so the same editor works for shoes, phones and
// grocery packs alike. Payload building and price mapping: ./productVariants.

function AttributeRows({ variantIndex, attributes, onChange, listId }) {
  function update(i, key, value) {
    onChange(attributes.map((a, idx) => (idx === i ? { ...a, [key]: value } : a)))
  }

  return (
    <div className="flex flex-col gap-2">
      {attributes.map((attr, i) => (
        <div key={i} className="flex items-end gap-2">
          <Input
            id={`variant-${variantIndex}-attr-name-${i}`}
            label={i === 0 ? 'Attribute' : undefined}
            placeholder="Color"
            list={listId}
            value={attr.name}
            onChange={(e) => update(i, 'name', e.target.value)}
            containerClassName="flex-1"
          />
          <Input
            id={`variant-${variantIndex}-attr-value-${i}`}
            label={i === 0 ? 'Value' : undefined}
            placeholder="Black"
            value={attr.value}
            onChange={(e) => update(i, 'value', e.target.value)}
            containerClassName="flex-1"
          />
          <Button
            type="button"
            variant="quiet"
            size="control"
            iconOnly
            icon="delete"
            aria-label={`Remove attribute ${i + 1}`}
            disabled={attributes.length === 1}
            onClick={() => onChange(attributes.filter((_, idx) => idx !== i))}
          />
        </div>
      ))}
      <Button
        type="button"
        variant="quiet"
        size="sm"
        icon="add"
        className="self-start"
        onClick={() => onChange([...attributes, { name: '', value: '' }])}
      >
        Add attribute
      </Button>
    </div>
  )
}

// Picks one of the product's gallery photos. `gallery` is [{ key, src }],
// where key is the kept URL or the new File object.
function VariantImagePicker({ value, gallery, onChange }) {
  const inGallery = gallery.some((g) => g.key === value)
  const ownImage = value && !(value instanceof File) && !inGallery ? value : null

  const tile = (selected) =>
    `relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border bg-white ${
      selected ? 'border-brand-500 ring-2 ring-brand-200' : 'border-slate-200 hover:border-slate-400'
    }`

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-slate-700">Variant Image (Optional)</span>
      {gallery.length === 0 && !ownImage ? (
        <p className="text-2xs text-slate-400">Add product images above, then pick one for this variant.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => onChange(null)} className={`${tile(!value)} flex items-center justify-center`} title="No specific image">
            <Icon name="close" className="h-4 w-4 text-slate-400" />
          </button>
          {ownImage && (
            <button type="button" className={tile(true)} title="This variant's own image">
              <img src={ownImage} alt="" className="h-full w-full object-cover" />
            </button>
          )}
          {gallery.map((g, i) => (
            <button key={i} type="button" onClick={() => onChange(g.key)} className={tile(g.key === value)} title={`Gallery image ${i + 1}`}>
              <img src={g.src} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function ProductVariantsSection({ variants, onChange, gallery }) {
  const listId = useId()

  function update(index, patch) {
    onChange(variants.map((v, i) => (i === index ? { ...v, ...patch } : v)))
  }

  function add() {
    // Seeded from the last variant's attribute NAMES and prices — the next
    // row is usually the same product in another size or colour.
    const last = variants[variants.length - 1]
    onChange([
      ...variants,
      emptyVariant(
        last
          ? {
              attributes: last.attributes.map((a) => ({ name: a.name, value: '' })),
              sellingPrice: last.sellingPrice,
              mrp: last.mrp,
              costPrice: last.costPrice,
              weight: last.weight,
            }
          : {},
      ),
    ])
  }

  const usedNames = new Set(COMMON_ATTRIBUTES)
  variants.forEach((v) => v.attributes.forEach((a) => a.name.trim() && usedNames.add(a.name.trim())))

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-50 text-[10px] font-bold text-brand-600 ring-1 ring-brand-200">
              7
            </span>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">Variants (Optional)</h3>
          </div>
          <p className="mt-0.5 text-2xs text-slate-500">
            For products sold in sizes, colours or pack sizes that differ in price or stock.
          </p>
        </div>
        {variants.length > 0 && (
          <Badge tone="brand" size="sm">
            {variants.length}
          </Badge>
        )}
      </div>

      {variants.length > 0 && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-2xs text-amber-800 ring-1 ring-amber-200">
          With variants, buyers must pick one before adding to cart, and each sells from its <strong>own stock</strong> — the
          product-level Stock Quantity above is no longer used.
        </p>
      )}

      <datalist id={listId}>
        {[...usedNames].map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>

      {variants.map((variant, index) => {
        const title = variant.name.trim() || attributeLabel(variant.attributes) || 'New variant'
        return (
          <div key={variant.id ?? `new-${index}`} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="text-2xs font-bold uppercase tracking-wider text-slate-400">#{index + 1}</span>
                <span className="truncate text-xs font-semibold text-slate-900">{title}</span>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id={`variant-${index}-active`}
                  label="Available"
                  checked={variant.isActive}
                  onChange={(e) => update(index, { isActive: e.target.checked })}
                />
                <Button
                  type="button"
                  variant="quiet"
                  size="control"
                  iconOnly
                  icon="delete"
                  aria-label={`Remove variant ${index + 1}`}
                  onClick={() => onChange(variants.filter((_, i) => i !== index))}
                />
              </div>
            </div>

            <AttributeRows
              variantIndex={index}
              attributes={variant.attributes}
              listId={listId}
              onChange={(attributes) => update(index, { attributes })}
            />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                id={`variant-${index}-name`}
                label="Variant Name"
                placeholder={attributeLabel(variant.attributes) || 'Black / XL'}
                description="Left blank, built from the attribute values."
                value={variant.name}
                onChange={(e) => update(index, { name: e.target.value })}
              />
              <Input
                id={`variant-${index}-sku`}
                label="Variant SKU"
                required={!variant.id}
                placeholder="SHOE-BLK-XL"
                value={variant.sku}
                onChange={(e) => update(index, { sku: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <Input
                id={`variant-${index}-selling`}
                label="Selling Price (₹)"
                required
                type="number"
                min="0"
                step="0.01"
                value={variant.sellingPrice}
                onChange={(e) => update(index, { sellingPrice: e.target.value })}
              />
              <Input
                id={`variant-${index}-mrp`}
                label="MRP (₹)"
                type="number"
                min="0"
                step="0.01"
                placeholder="Optional"
                value={variant.mrp}
                onChange={(e) => update(index, { mrp: e.target.value })}
              />
              <Input
                id={`variant-${index}-cost`}
                label="Cost Price (₹)"
                type="number"
                min="0"
                step="0.01"
                placeholder="Optional"
                value={variant.costPrice}
                onChange={(e) => update(index, { costPrice: e.target.value })}
              />
              <Input
                id={`variant-${index}-stock`}
                label="Stock"
                required
                type="number"
                min="0"
                step="1"
                value={variant.stock}
                onChange={(e) => update(index, { stock: e.target.value.replace(/[^0-9]/g, '') })}
              />
              <Input
                id={`variant-${index}-weight`}
                label="Weight (kg)"
                type="number"
                min="0.001"
                step="0.01"
                placeholder="Same as product"
                value={variant.weight}
                onChange={(e) => update(index, { weight: e.target.value })}
              />
            </div>

            <VariantImagePicker
              value={variant.image}
              gallery={gallery}
              onChange={(image) => update(index, { image })}
            />
          </div>
        )
      })}

      <Button type="button" variant="secondary" size="sm" icon="add" onClick={add} className="self-start">
        {variants.length === 0 ? 'Add variants' : 'Add another variant'}
      </Button>
    </div>
  )
}
