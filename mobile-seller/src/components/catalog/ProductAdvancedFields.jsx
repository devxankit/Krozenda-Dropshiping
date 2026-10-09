import { useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { Badge, Button, Icon, Input, Select, Text } from '../ui'
import { colors, radius } from '../../theme'
import { formatRupees } from './tw'

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

const fmt = (n) => formatRupees(n)

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
    <View style={styles.collapsible}>
      <Pressable
        onPress={() => setIsOpen(!isOpen)}
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
        style={({ pressed }) => [styles.collapsibleHead, pressed && { backgroundColor: colors.surface.muted }]}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.titleRow}>
            <Text style={styles.collapsibleTitle}>{title}</Text>
            {badge ? (
              <Badge tone="brand" size="sm">
                {badge}
              </Badge>
            ) : null}
          </View>
          {description ? <Text style={styles.collapsibleDesc}>{description}</Text> : null}
        </View>
        <Icon name={isOpen ? 'chevronUp' : 'chevronDown'} size={16} color={colors.ink.subtle} />
      </Pressable>

      {isOpen ? <View style={styles.collapsibleBody}>{children}</View> : null}
    </View>
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
    <View style={{ gap: 12 }}>
      <Input
        label="Weight (kg)"
        type="number"
        placeholder="0.5"
        value={value.weight || ''}
        onChange={set('weight')}
        description="Used to quote shipping. Left blank, your default package is used instead."
      />

      <View style={{ gap: 12 }}>
        <Input label="Length (cm)" type="number" value={dims.lengthCm || ''} onChange={setDim('lengthCm')} />
        <Input label="Breadth (cm)" type="number" value={dims.breadthCm || ''} onChange={setDim('breadthCm')} />
        <Input label="Height (cm)" type="number" value={dims.heightCm || ''} onChange={setDim('heightCm')} />
      </View>

      {partial ? (
        <Text style={styles.warn}>
          Enter all three dimensions or none — a partial set cannot produce a volumetric weight and will be ignored.
        </Text>
      ) : null}
    </View>
  )
}

const GST_TYPE_OPTIONS = [
  { value: 'inclusive', label: 'Inclusive — price already includes GST' },
  { value: 'exclusive', label: 'Exclusive — GST added on top at checkout' },
]

// Whether the price entered already contains GST. Shared by the admin product
// form and both seller product modals, with a one-line preview of what the
// buyer will actually pay so the choice is never abstract.
export function GstTypeField({ inclusive, onChange, price, gstRate }) {
  const rate = gstRate === '' || gstRate === null || gstRate === undefined ? null : Number(gstRate)
  const amount = Number(price) || 0

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
    <View style={{ gap: 4 }}>
      <Select
        label="GST Type"
        options={GST_TYPE_OPTIONS}
        value={inclusive === false ? 'exclusive' : 'inclusive'}
        onChange={(e) => onChange(e.target.value !== 'exclusive')}
      />
      {preview ? <Text style={styles.preview}>{preview}</Text> : null}
    </View>
  )
}

export function TaxFields({ value, onChange }) {
  const set = (key) => (e) => onChange({ ...value, [key]: e.target.value })

  return (
    <View style={{ gap: 12 }}>
      <Input
        label="HSN code"
        placeholder="6109"
        keyboardType="number-pad"
        value={value.hsnCode || ''}
        onChange={set('hsnCode')}
        description="4 to 8 digits. Required on a GST invoice."
      />
      <Select
        label="GST rate"
        options={GST_OPTIONS}
        value={value.gstRate ?? ''}
        onChange={set('gstRate')}
        description="Prices you enter are treated as GST-inclusive."
      />
    </View>
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
    <View style={{ gap: 10 }}>
      {tiers.length === 0 ? (
        <Text style={styles.hint}>No bulk pricing. Add a break to charge less per unit above a quantity.</Text>
      ) : null}

      {tiers.map((tier, index) => (
        <View key={index} style={styles.tierRow}>
          <Input
            label={index === 0 ? 'Buy at least' : undefined}
            type="number"
            keyboardType="number-pad"
            placeholder="10"
            value={tier.minQty}
            onChange={(e) => update(index, 'minQty', e.target.value)}
            containerStyle={{ flex: 1 }}
          />
          <Input
            label={index === 0 ? 'Unit price (₹)' : undefined}
            type="number"
            placeholder="80"
            value={tier.price}
            onChange={(e) => update(index, 'price', e.target.value)}
            containerStyle={{ flex: 1 }}
          />
          <Button
            variant="quiet"
            size="control"
            iconOnly
            icon="delete"
            accessibilityLabel={`Remove quantity break ${index + 1}`}
            onPress={() => onChange(tiers.filter((_, i) => i !== index))}
          />
        </View>
      ))}

      <Button variant="secondary" size="sm" icon="add" onPress={add} style={{ alignSelf: 'flex-start' }}>
        Add a quantity break
      </Button>

      {tooHigh.length > 0 ? (
        <Text style={styles.warn}>
          A break priced at or above your regular price never applies — buyers are never charged more for buying more.
        </Text>
      ) : null}
    </View>
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
    <View style={{ gap: 12 }}>
      {variants.length === 0 ? (
        <Text style={styles.hint}>
          No options. Add one if this product comes in sizes, colours or pack sizes that differ in price or stock.
        </Text>
      ) : (
        <Text style={styles.warn}>
          With options set, buyers must pick one before adding to cart, and each option sells from its own stock — the
          product-level stock above is no longer used.
        </Text>
      )}

      {variants.map((variant, index) => (
        <View key={index} style={styles.variantCard}>
          <View style={styles.tierRow}>
            <Input
              label="Option name"
              placeholder="Red / L"
              value={variant.name}
              onChange={(e) => update(index, 'name', e.target.value)}
              containerStyle={{ flex: 1 }}
              required
            />
            <Button
              variant="quiet"
              size="control"
              iconOnly
              icon="delete"
              accessibilityLabel={`Remove option ${index + 1}`}
              onPress={() => onChange(variants.filter((_, i) => i !== index))}
            />
          </View>

          <View style={{ gap: 10 }}>
            <Input label="SKU" placeholder="Optional" value={variant.sku} onChange={(e) => update(index, 'sku', e.target.value)} />
            <Input
              label="Price (₹)"
              type="number"
              placeholder="Same as product"
              value={variant.price}
              onChange={(e) => update(index, 'price', e.target.value)}
            />
            <Input
              label="Sale price (₹)"
              type="number"
              placeholder="Optional"
              value={variant.salePrice}
              onChange={(e) => update(index, 'salePrice', e.target.value)}
            />
            <Input
              label="Stock"
              type="number"
              keyboardType="number-pad"
              value={variant.stock}
              onChange={(e) => update(index, 'stock', e.target.value)}
            />
          </View>
        </View>
      ))}

      <Button variant="secondary" size="sm" icon="add" onPress={add} style={{ alignSelf: 'flex-start' }}>
        Add an option
      </Button>
    </View>
  )
}

const styles = StyleSheet.create({
  collapsible: { borderWidth: 1, borderColor: colors.border.DEFAULT, borderRadius: radius.md },
  collapsibleHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.md,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  collapsibleTitle: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.slate[900] },
  collapsibleDesc: { marginTop: 2, fontSize: 11, lineHeight: 16, color: colors.ink.subtle },
  collapsibleBody: { borderTopWidth: 1, borderTopColor: colors.border.DEFAULT, padding: 12 },
  warn: { fontSize: 11, lineHeight: 16, color: colors.warning[700] },
  hint: { fontSize: 11, lineHeight: 16, color: colors.ink.subtle },
  preview: { fontSize: 11, lineHeight: 16, fontWeight: '500', color: colors.ink.muted },
  tierRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  variantCard: {
    gap: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.DEFAULT,
    backgroundColor: colors.surface.muted,
    padding: 10,
  },
})
