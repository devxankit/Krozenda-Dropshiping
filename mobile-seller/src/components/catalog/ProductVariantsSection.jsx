import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { Image } from 'expo-image'
import { Badge, Button, Checkbox, Icon, Input, Text, resolveImageSource } from '../ui'
import { colors, radius, shadows } from '../../theme'
import { Cols, SectionHeading } from './layout'
import { withAlpha } from './tw'
import { COMMON_ATTRIBUTES, attributeLabel, emptyVariant, isLocalFile } from './productVariants'

// Options a buyer picks between — sizes, colours, pack sizes — each with its
// own price and stock. Attributes are free-form name/value pairs rather than
// fixed Color/Size columns, so the same editor works for shoes, phones and
// grocery packs alike. Payload building and price mapping: ./productVariants.

// The web's <datalist> of attribute names becomes a strip of tappable suggestions under the focused
// name field.
function AttributeRows({ attributes, onChange, suggestions }) {
  const [focused, setFocused] = useState(null)

  function update(i, key, value) {
    onChange(attributes.map((a, idx) => (idx === i ? { ...a, [key]: value } : a)))
  }

  return (
    <View style={{ gap: 8 }}>
      {attributes.map((attr, i) => {
        const typed = attr.name.trim().toLowerCase()
        const options = suggestions.filter((n) => n.toLowerCase().includes(typed) && n.toLowerCase() !== typed)
        return (
          <View key={i} style={{ gap: 6 }}>
            <View style={styles.attrRow}>
              <Input
                label={i === 0 ? 'Attribute' : undefined}
                placeholder="Color"
                value={attr.name}
                onChange={(e) => update(i, 'name', e.target.value)}
                onFocus={() => setFocused(i)}
                onBlur={() => setFocused((cur) => (cur === i ? null : cur))}
                containerStyle={{ flex: 1 }}
              />
              <Input
                label={i === 0 ? 'Value' : undefined}
                placeholder="Black"
                value={attr.value}
                onChange={(e) => update(i, 'value', e.target.value)}
                containerStyle={{ flex: 1 }}
              />
              <Button
                variant="quiet"
                size="control"
                iconOnly
                icon="delete"
                accessibilityLabel={`Remove attribute ${i + 1}`}
                disabled={attributes.length === 1}
                onPress={() => onChange(attributes.filter((_, idx) => idx !== i))}
              />
            </View>
            {focused === i && options.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always" contentContainerStyle={{ gap: 6 }}>
                {options.map((n) => (
                  <Pressable key={n} onPress={() => update(i, 'name', n)} style={styles.suggestion}>
                    <Text style={styles.suggestionText}>{n}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}
          </View>
        )
      })}
      <Button
        variant="quiet"
        size="sm"
        icon="add"
        style={{ alignSelf: 'flex-start' }}
        onPress={() => onChange([...attributes, { name: '', value: '' }])}
      >
        Add attribute
      </Button>
    </View>
  )
}

// Picks one of the product's gallery photos. `gallery` is [{ key, src }],
// where key is the kept URL or the new local file object.
function VariantImagePicker({ value, gallery, onChange }) {
  const inGallery = gallery.some((g) => g.key === value)
  const ownImage = value && !isLocalFile(value) && !inGallery ? value : null

  const tile = (selected) => [styles.tile, selected ? styles.tileOn : styles.tileOff]

  return (
    <View style={{ gap: 4 }}>
      <Text style={styles.pickerLabel}>Variant Image (Optional)</Text>
      {gallery.length === 0 && !ownImage ? (
        <Text style={styles.pickerHint}>Add product images above, then pick one for this variant.</Text>
      ) : (
        <View style={styles.tiles}>
          <Pressable onPress={() => onChange(null)} accessibilityLabel="No specific image" style={[...tile(!value), { alignItems: 'center', justifyContent: 'center' }]}>
            <Icon name="close" size={16} color={colors.slate[400]} />
          </Pressable>
          {ownImage ? (
            <View style={tile(true)}>
              <Image source={resolveImageSource(ownImage)} style={StyleSheet.absoluteFill} contentFit="cover" />
            </View>
          ) : null}
          {gallery.map((g, i) => (
            <Pressable key={i} onPress={() => onChange(g.key)} accessibilityLabel={`Gallery image ${i + 1}`} style={tile(g.key === value)}>
              <Image source={resolveImageSource(g.src)} style={StyleSheet.absoluteFill} contentFit="cover" />
            </Pressable>
          ))}
        </View>
      )}
    </View>
  )
}

export function ProductVariantsSection({ variants, onChange, gallery }) {
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
  const suggestions = [...usedNames]

  return (
    <View style={styles.card}>
      <View style={styles.headRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <SectionHeading step={7}>Variants (Optional)</SectionHeading>
          <Text style={styles.sub}>For products sold in sizes, colours or pack sizes that differ in price or stock.</Text>
        </View>
        {variants.length > 0 ? (
          <Badge tone="brand" size="sm">
            {variants.length}
          </Badge>
        ) : null}
      </View>

      {variants.length > 0 ? (
        <View style={styles.amber}>
          <Text style={styles.amberText}>
            With variants, buyers must pick one before adding to cart, and each sells from its{' '}
            <Text style={[styles.amberText, { fontWeight: '700' }]}>own stock</Text> — the product-level Stock Quantity above is no longer
            used.
          </Text>
        </View>
      ) : null}

      {variants.map((variant, index) => {
        const title = variant.name.trim() || attributeLabel(variant.attributes) || 'New variant'
        return (
          <View key={variant.id ?? `new-${index}`} style={styles.variant}>
            <View style={styles.variantHead}>
              <View style={styles.variantTitle}>
                <Text noTranslate style={styles.variantNo}>
                  #{index + 1}
                </Text>
                <Text numberOfLines={1} style={styles.variantName}>
                  {title}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Checkbox label="Available" checked={variant.isActive} onChange={(e) => update(index, { isActive: e.target.checked })} />
                <Button
                  variant="quiet"
                  size="control"
                  iconOnly
                  icon="delete"
                  accessibilityLabel={`Remove variant ${index + 1}`}
                  onPress={() => onChange(variants.filter((_, i) => i !== index))}
                />
              </View>
            </View>

            <AttributeRows
              attributes={variant.attributes}
              suggestions={suggestions}
              onChange={(attributes) => update(index, { attributes })}
            />

            <View style={{ gap: 12 }}>
              <Input
                label="Variant Name"
                placeholder={attributeLabel(variant.attributes) || 'Black / XL'}
                description="Left blank, built from the attribute values."
                value={variant.name}
                onChange={(e) => update(index, { name: e.target.value })}
              />
              <Input
                label="Variant SKU"
                required={!variant.id}
                placeholder="SHOE-BLK-XL"
                value={variant.sku}
                onChange={(e) => update(index, { sku: e.target.value })}
              />
            </View>

            <Cols n={2} gap={12}>
              <Input
                label="Selling Price (₹)"
                required
                type="number"
                value={variant.sellingPrice}
                onChange={(e) => update(index, { sellingPrice: e.target.value })}
              />
              <Input
                label="MRP (₹)"
                type="number"
                placeholder="Optional"
                value={variant.mrp}
                onChange={(e) => update(index, { mrp: e.target.value })}
              />
              <Input
                label="Cost Price (₹)"
                type="number"
                placeholder="Optional"
                value={variant.costPrice}
                onChange={(e) => update(index, { costPrice: e.target.value })}
              />
              <Input
                label="Stock"
                required
                type="number"
                keyboardType="number-pad"
                value={variant.stock}
                onChange={(e) => update(index, { stock: e.target.value.replace(/[^0-9]/g, '') })}
              />
              <Input
                label="Weight (kg)"
                type="number"
                placeholder="Same as product"
                value={variant.weight}
                onChange={(e) => update(index, { weight: e.target.value })}
              />
            </Cols>

            <VariantImagePicker value={variant.image} gallery={gallery} onChange={(image) => update(index, { image })} />
          </View>
        )
      })}

      <Button variant="secondary" size="sm" icon="add" onPress={add} style={{ alignSelf: 'flex-start' }}>
        {variants.length === 0 ? 'Add variants' : 'Add another variant'}
      </Button>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    gap: 12,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: withAlpha(colors.slate[200], 0.9),
    backgroundColor: '#fff',
    padding: 16,
    ...shadows['2xs'],
  },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  sub: { marginTop: 2, fontSize: 11, lineHeight: 16, color: colors.slate[500] },
  amber: {
    borderRadius: radius.md,
    backgroundColor: colors.amber[50],
    borderWidth: 1,
    borderColor: colors.amber[200],
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  amberText: { fontSize: 11, lineHeight: 16, color: colors.amber[800] },
  variant: {
    gap: 12,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.slate[200],
    backgroundColor: withAlpha(colors.slate[50], 0.6),
    padding: 14,
  },
  variantHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  variantTitle: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
  variantNo: { fontSize: 11, lineHeight: 16, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', color: colors.slate[400] },
  variantName: { flexShrink: 1, fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.slate[900] },
  attrRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  suggestion: {
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: colors.slate[200],
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  suggestionText: { fontSize: 11, lineHeight: 16, fontWeight: '500', color: colors.slate[600] },
  pickerLabel: { fontSize: 12, lineHeight: 16, fontWeight: '500', color: colors.slate[700] },
  pickerHint: { fontSize: 11, lineHeight: 16, color: colors.slate[400] },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { height: 48, width: 48, overflow: 'hidden', borderRadius: radius.md, borderWidth: 1, backgroundColor: '#fff' },
  tileOn: { borderColor: colors.brand[500], borderWidth: 2 },
  tileOff: { borderColor: colors.slate[200] },
})
