import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Image } from 'expo-image'
import { Button, Text, resolveImageSource } from '../../../components/ui'
import { ListScreen } from '../../../components/admin/data/ListScreen'
import { InlineAlert } from '../../../components/admin/feedback'
import { formatIndian } from '../../../lib/format'
import { colors } from '../../../theme'
import { useVendorInventoryController } from '../controllers/useVendorController'
import { UpdateStockModal } from '../components/modals/UpdateStockModal'

export function VendorInventoryPage() {
  const controller = useVendorInventoryController()
  const [selectedProduct, setSelectedProduct] = useState(null)

  const outOfStock = controller.tabCounts?.out_of_stock || 0

  const columns = [
    {
      key: 'name',
      header: 'Product',
      width: '12rem',
      render: (row) => (
        <View style={styles.productCell}>
          {row.image ? <Image source={resolveImageSource(row.image)} style={styles.thumb} contentFit="cover" /> : null}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.name}>{row.name}</Text>
            <Text noTranslate style={styles.sku}>
              {row.sku || '—'}
            </Text>
          </View>
        </View>
      ),
    },
    {
      key: 'stock',
      header: 'Available Stock',
      width: '12rem',
      align: 'right',
      render: (row) => (
        <View style={styles.stockCell}>
          <Text
            style={[
              styles.stock,
              { color: row.isOutOfStock ? colors.danger[600] : row.isLowStock ? colors.warning[700] : colors.slate[900] },
            ]}
          >
            {row.isOutOfStock ? 'Out of stock' : `${formatIndian(row.stock)} units`}
          </Text>
          <Button size="xs" variant="secondary" onPress={() => setSelectedProduct(row)}>
            Adjust
          </Button>
        </View>
      ),
    },
  ]

  return (
    <>
      <ListScreen
        title="Inventory"
        description="Track and adjust stock for your products."
        banner={
          outOfStock > 0 ? (
            <InlineAlert tone="warning" title={`${outOfStock} products are out of stock`}>
              Out-of-stock products stay listed but can&apos;t be ordered until you restock them.
            </InlineAlert>
          ) : null
        }
        controller={controller}
        columns={columns}
        tabs={[
          { id: 'all', label: 'All' },
          { id: 'low_stock', label: 'Low Stock' },
          { id: 'out_of_stock', label: 'Out of Stock' },
        ]}
        itemLabel="products"
      />

      <UpdateStockModal
        key={selectedProduct?.id}
        product={selectedProduct}
        isOpen={Boolean(selectedProduct)}
        onClose={() => setSelectedProduct(null)}
        onUpdateStock={controller.updateStock}
      />
    </>
  )
}

const styles = StyleSheet.create({
  productCell: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  thumb: { height: 32, width: 32, borderRadius: 6 },
  name: { fontSize: 12, lineHeight: 16, fontWeight: '500', color: colors.slate[900] },
  sku: { fontFamily: 'monospace', fontSize: 11, lineHeight: 16, color: colors.ink.subtle },
  stockCell: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  stock: { fontSize: 12, fontWeight: '600' },
})
