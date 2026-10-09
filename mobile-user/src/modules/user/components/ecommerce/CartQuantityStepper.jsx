import { StyleSheet, View } from 'react-native'
import { Icon } from '../../../../components/ui/Icon'
import { Animated, PressableScale, usePop } from '../../../../components/ui/motion'
import { Text } from '../../../../components/ui/Text'
import { MAX_LINE_QUANTITY, useCartStore } from '../../../../lib/cartStore'
import { colors, radius } from '../../../../theme'

// The -/+ control that replaces "Add to Cart" once the item is in the cart.
//
// Every tap moves the number immediately. The network call behind it is debounced in the cart
// store, so +,+,+,- in a second is one request carrying the number the stepper actually landed
// on. The stepper reads its quantity from the store, so it always agrees with the cart badge and
// the cart page.
export function CartQuantityStepper({ productId, stock, style }) {
  const quantity = useCartStore((state) => state.items.find((item) => item.id === productId)?.quantity ?? 0)
  const setQuantity = useCartStore((state) => state.setQuantity)
  // Hook runs before the early return below so hook order is stable.
  const popStyle = usePop(quantity)

  if (quantity < 1) return null

  // The real ceiling is whichever is lower: what is on the shelf, or the per-line cap the server
  // enforces.
  const ceiling = Math.min(MAX_LINE_QUANTITY, Number.isFinite(Number(stock)) && stock > 0 ? Number(stock) : MAX_LINE_QUANTITY)
  const atCeiling = quantity >= ceiling
  const willRemove = quantity <= 1

  return (
    <View style={[styles.wrap, style]}>
      <PressableScale
        onPress={() => setQuantity(productId, quantity - 1)}
        scaleTo={0.9}
        accessibilityRole="button"
        accessibilityLabel={willRemove ? 'Remove from cart' : 'Decrease quantity'}
        style={styles.btn}
      >
        <Icon name={willRemove ? 'HiTrash' : 'HiMinus'} size={20} color={colors.blue[700]} />
      </PressableScale>

      <Animated.View style={popStyle}>
        <Text noTranslate style={styles.qty} accessibilityLabel={`Quantity ${quantity}`} accessibilityLiveRegion="polite">
          {quantity}
        </Text>
      </Animated.View>

      <PressableScale
        onPress={() => setQuantity(productId, quantity + 1)}
        disabled={atCeiling}
        scaleTo={0.9}
        accessibilityRole="button"
        accessibilityState={{ disabled: atCeiling }}
        accessibilityLabel="Increase quantity"
        style={styles.btn}
      >
        <Icon name="HiPlus" size={20} color={atCeiling ? colors.slate[300] : colors.blue[700]} />
      </PressableScale>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderRadius: radius['2xl'],
    borderWidth: 2,
    borderColor: colors.blue[700],
    backgroundColor: '#fff',
    padding: 8,
  },
  btn: { height: 44, width: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.xl, backgroundColor: colors.blue[50] },
  qty: { minWidth: 32, textAlign: 'center', fontSize: 14, lineHeight: 20, fontWeight: '800', color: colors.slate[900] },
})
