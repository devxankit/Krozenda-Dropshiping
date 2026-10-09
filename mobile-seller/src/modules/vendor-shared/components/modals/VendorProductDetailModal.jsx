import { StyleSheet, View } from 'react-native'
import { Image } from 'expo-image'
import { Badge, Button, DEFAULT_PRODUCT_IMAGE, Modal, Text, resolveImageSource } from '../../../../components/ui'
import { ProductBarcode } from '../../../../components/common/ProductBarcode'
import { formatRupees } from '../../../../components/catalog/tw'
import { formatIndian } from '../../../../lib/format'
import { colors } from '../../../../theme'

// Read-only product view for the seller panel — what a barcode scan opens,
// and the "View details" action on a product row. Editing stays in the
// existing Edit / Update-stock modals, reachable from the footer.

const APPROVAL_TONE = { APPROVED: 'success', PENDING: 'warning', REJECTED: 'danger' }

function Field({ label, children }) {
  const value = children ?? '—'
  return (
    <View style={styles.field}>
      <Text style={styles.dt}>{label}</Text>
      {typeof value === 'string' || typeof value === 'number' ? <Text style={styles.dd}>{value}</Text> : value}
    </View>
  )
}

export function VendorProductDetailModal({ product, isOpen, onClose, onEdit, onUpdateStock }) {
  if (!product) return null

  const stock = product.variants?.length > 0 ? product.variantStock : product.stock
  const fields = [
    <Field key="sku" label="SKU">
      {product.sku || '—'}
    </Field>,
    <Field key="cat" label="Category">
      {product.category?.name || '—'}
    </Field>,
    <Field key="brand" label="Brand">
      {product.brand?.name || '—'}
    </Field>,
    <Field key="price" label="Selling price">
      <Text noTranslate style={styles.dd}>
        {formatRupees(product.price)}
      </Text>
    </Field>,
    <Field key="sale" label="Sale price">
      <Text noTranslate style={styles.dd}>
        {formatRupees(product.salePrice)}
      </Text>
    </Field>,
    <Field key="mrp" label="MRP">
      <Text noTranslate style={styles.dd}>
        {formatRupees(product.mrp)}
      </Text>
    </Field>,
    <Field key="stock" label="Stock">
      <Text style={[styles.dd, stock > 0 ? null : { color: colors.danger[600] }]}>
        {stock > 0 ? `${formatIndian(stock)} units` : 'Out of stock'}
      </Text>
    </Field>,
    <Field key="hsn" label="HSN / GST">
      {[product.hsnCode, product.gstRate != null ? `${product.gstRate}%` : null].filter(Boolean).join(' · ') || '—'}
    </Field>,
    <Field key="weight" label="Weight">
      {product.weight != null ? `${product.weight} kg` : '—'}
    </Field>,
  ]
  const rows = []
  for (let i = 0; i < fields.length; i += 2) rows.push(fields.slice(i, i + 2))

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Product details"
      footer={
        <>
          <Button variant="secondary" onPress={() => onUpdateStock(product)}>
            Update stock
          </Button>
          <Button onPress={() => onEdit(product)}>Edit product</Button>
        </>
      }
    >
      <View style={{ gap: 20 }}>
        <View style={{ flexDirection: 'row', gap: 16 }}>
          <View style={styles.thumb}>
            <Image
              source={resolveImageSource(product.images?.[0] || DEFAULT_PRODUCT_IMAGE)}
              style={{ height: '100%', width: '100%' }}
              contentFit="contain"
            />
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
            <Text style={styles.name}>{product.name}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
              <Badge tone={product.isActive ? 'success' : 'neutral'} size="sm">
                {product.status}
              </Badge>
              <Badge tone={APPROVAL_TONE[product.approvalStatus] || 'neutral'} size="sm">
                {product.approvalStatus}
              </Badge>
            </View>
            {product.approvalStatus === 'REJECTED' && product.rejectionReason ? (
              <Text style={styles.reason}>{product.rejectionReason}</Text>
            ) : null}
          </View>
        </View>

        <View style={{ gap: 16 }}>
          {rows.map((row, r) => (
            <View key={r} style={{ flexDirection: 'row', gap: 16 }}>
              {row}
              {row.length < 2 ? <View style={{ flex: 1 }} /> : null}
            </View>
          ))}
        </View>

        {product.shortDescription ? <Text style={styles.short}>{product.shortDescription}</Text> : null}

        {product.barcode ? (
          <ProductBarcode
            code={product.barcode}
            imageUrl={`/vendor/products/${product.id}/barcode.png?v=6`}
            qrUrl={`/vendor/products/${product.id}/qrcode.png`}
            product={product}
          />
        ) : null}
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  thumb: {
    height: 80,
    width: 80,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.slate[100],
    backgroundColor: '#fff',
    padding: 4,
  },
  name: { fontSize: 16, lineHeight: 24, fontWeight: '700', color: colors.slate[900] },
  reason: { fontSize: 12, lineHeight: 16, color: colors.danger[600] },
  field: { flex: 1, minWidth: 0, gap: 2 },
  dt: { fontSize: 11, lineHeight: 16, fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase', color: colors.slate[500] },
  dd: { fontSize: 14, lineHeight: 20, fontWeight: '500', color: colors.slate[900] },
  short: { fontSize: 14, lineHeight: 20, color: colors.slate[600] },
})
