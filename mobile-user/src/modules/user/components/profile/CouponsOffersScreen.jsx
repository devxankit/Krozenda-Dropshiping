import { Pressable, ScrollView, View, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { Screen } from '../../../../components/layout/Screen'
import { Text } from '../../../../components/ui/Text'
import { Icon } from '../../../../components/ui/Icon'
import { Skeleton } from '../../../../components/ui/Skeleton'
import { Animated, enterFade } from '../../../../components/ui/motion'
import { SmartImage } from '../../../../components/ui/SmartImage'
import { USER_ROUTES } from '../../../../config/routes'
import { useUsedCouponsController } from '../../controllers/useCouponsController'
import { colors, radius, shadows } from '../../../../theme'

export function CouponsOffersScreen({ onBack }) {
  const router = useRouter()
  const handleBack =
    onBack ||
    (() => {
      if (router.canGoBack()) router.back()
      else router.replace(USER_ROUTES.DASHBOARD)
    })

  const { usedCoupons, isLoading: loadingUsed } = useUsedCouponsController()

  return (
    <Screen>
      <View style={{ padding: 16, gap: 32 }}>
        {/* Header */}
        <View style={[styles.card, shadows.xs, { padding: 24, flexDirection: 'row', alignItems: 'center', gap: 16 }]}>
          <Pressable onPress={handleBack} accessibilityLabel="Back" style={{ padding: 8, borderRadius: 9999 }}>
            <Icon name="HiArrowLeft" size={20} color={colors.slate[700]} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 20, lineHeight: 28, fontWeight: '800', color: colors.slate[900] }}>Coupons & Offers</Text>
            <Text style={{ fontSize: 12, color: colors.slate[500], marginTop: 2 }}>
              Coupons you've used, with the products they were applied to.
            </Text>
          </View>
        </View>

        {/* Used coupons */}
        <View style={{ gap: 16 }}>
          <Text style={{ fontSize: 14, fontWeight: '800', color: colors.slate[900], textTransform: 'uppercase', letterSpacing: 0.35 }}>
            Used Coupons
          </Text>

          {loadingUsed ? (
            <View style={{ gap: 16 }}>
              {[0, 1].map((n) => (
                <View key={n} style={[styles.card, { padding: 20, gap: 12 }]}>
                  <Skeleton style={{ height: 16, width: '45%' }} />
                  <Skeleton style={{ height: 12, width: '80%' }} />
                  <Skeleton style={{ height: 12, width: '55%' }} />
                </View>
              ))}
            </View>
          ) : usedCoupons.length === 0 ? (
            <View style={[styles.card, { padding: 32 }]}>
              <Text style={styles.empty}>You haven't used any coupons yet.</Text>
            </View>
          ) : (
            <View style={{ gap: 16 }}>
              {usedCoupons.map((used, index) => (
                <Animated.View key={used.id} entering={enterFade(index)} style={[styles.card, shadows.xs, { padding: 20, gap: 16 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={styles.tagIcon}>
                        <Icon name="HiTag" size={16} color={colors.blue[600]} />
                      </View>
                      <View>
                        <Text noTranslate style={{ fontSize: 14, fontWeight: '800', color: colors.slate[900] }}>
                          {used.code}
                        </Text>
                        <Text style={{ fontSize: 11, color: colors.slate[500] }}>
                          {'Used on '}
                          <Text noTranslate style={{ fontSize: 11, color: colors.slate[500] }}>
                            {new Date(used.redeemedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </Text>
                        </Text>
                      </View>
                    </View>
                    <Text noTranslate style={{ fontSize: 12, fontWeight: '800', color: colors.emerald[600] }}>
                      Saved ₹{used.discountAmount.toLocaleString('en-IN')}
                    </Text>
                  </View>

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={{ borderTopWidth: 1, borderTopColor: colors.slate[100] }}
                    contentContainerStyle={{ paddingTop: 12, gap: 12 }}
                  >
                    {used.products.map((product, idx) => (
                      <View key={idx} style={styles.product}>
                        <View style={styles.productImg}>
                          <SmartImage src={product.image} alt={product.name} ratio={1} fit="contain" style={{ width: '100%', height: '100%' }} />
                        </View>
                        <View style={{ maxWidth: 140 }}>
                          <Text numberOfLines={1} noTranslate style={{ fontSize: 11, fontWeight: '700', color: colors.slate[900] }}>
                            {product.name}
                          </Text>
                          <Text noTranslate style={{ fontSize: 10, color: colors.slate[500] }}>
                            Qty {product.quantity} · ₹{product.price.toLocaleString('en-IN')}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </ScrollView>
                </Animated.View>
              ))}
            </View>
          )}
        </View>
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: radius['3xl'], borderWidth: 1, borderColor: 'rgba(226,232,240,0.8)' },
  empty: { fontSize: 12, fontWeight: '600', color: colors.slate[400], textAlign: 'center' },
  tagIcon: { width: 32, height: 32, borderRadius: radius.xl, backgroundColor: colors.blue[50], alignItems: 'center', justifyContent: 'center' },
  product: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.slate[50],
    borderWidth: 1,
    borderColor: colors.slate[100],
    borderRadius: radius.xl,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  productImg: {
    width: 36,
    height: 36,
    borderRadius: radius.lg,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.slate[100],
    padding: 2,
    overflow: 'hidden',
  },
})
