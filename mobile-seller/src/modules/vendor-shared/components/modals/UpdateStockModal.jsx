import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Button, Input, Modal, Text } from '../../../../components/ui'
import { toast } from '../../../../lib/toast'
import { ProductBarcode } from '../../../../components/common/ProductBarcode'
import { colors, radius } from '../../../../theme'

// Parent remounts this (key={product?.id}) whenever the target product
// changes, so the initial stock value below is always fresh without an
// effect-driven setState.
export function UpdateStockModal({ product, isOpen, onClose, onUpdateStock }) {
  const [stock, setStock] = useState(() => product?.stock?.toString() ?? '')

  if (!product) return null

  function save(qty) {
    // The web fires the update and closes at once; a failure here surfaces as a toast instead of an
    // unhandled rejection.
    Promise.resolve(onUpdateStock?.(product.id, qty)).catch((err) => toast.error('Could not update stock', err?.message))
  }

  function handleSubmit() {
    const newQty = parseInt(stock, 10) || 0
    save(newQty)
    toast.success('Stock Inventory Updated', `${product.sku} stock level set to ${newQty} units.`)
    onClose()
  }

  function handleMarkOutOfStock() {
    save(0)
    toast.warning('SKU Marked Out of Stock', `${product.sku} is now hidden from instant cart order placement.`)
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Update Inventory Stock — ${product.sku}`}
      description={`Update warehouse available quantity for ${product.name}`}
      footer={
        <>
          <Button variant="secondary" onPress={handleMarkOutOfStock}>
            Mark out of stock
          </Button>
          <Button onPress={handleSubmit} icon="save">
            Update stock
          </Button>
        </>
      }
    >
      <View style={{ gap: 16 }}>
        <View style={styles.summary}>
          <Text style={styles.summaryName}>{product.name}</Text>
          <Text style={styles.summarySku}>SKU: {product.sku || '—'}</Text>
        </View>

        {/* Assigned automatically when the product was created — see
            Models/Product.js — so it is always present by the time a seller
            can open this modal at all. */}
        {product.barcode ? (
          <ProductBarcode
            code={product.barcode}
            imageUrl={`/vendor/products/${product.id}/barcode.png?v=6`}
            qrUrl={`/vendor/products/${product.id}/qrcode.png`}
            product={product}
          />
        ) : null}

        <Input
          label="Current Stock Quantity (Units)"
          type="number"
          keyboardType="number-pad"
          value={stock}
          onChange={(e) => setStock(e.target.value)}
          onSubmitEditing={handleSubmit}
          returnKeyType="done"
          required
        />
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  summary: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.DEFAULT,
    backgroundColor: colors.surface.muted,
    padding: 12,
  },
  summaryName: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.slate[900] },
  summarySku: { marginTop: 2, fontSize: 12, lineHeight: 16, color: colors.ink.subtle },
})
