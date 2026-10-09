import { useEffect, useState } from 'react'
import { View, Pressable, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { Screen } from '../../../../components/layout/Screen'
import { Text } from '../../../../components/ui/Text'
import { Icon } from '../../../../components/ui/Icon'
import { Skeleton } from '../../../../components/ui/Skeleton'
import { Animated, PressableScale, enterFade, fadeIn } from '../../../../components/ui/motion'
import { USER_ROUTES } from '../../../../config/routes'
import { useCheckoutStore } from '../../../../lib/checkoutStore'
import { colors, shadows } from '../../../../theme'
import { useAddressesController } from '../../controllers/useAddressesController'
import { AddressFormModal } from '../profile/AddressFormModal'
import { CheckoutStepper } from './CheckoutStepper'

export function SelectAddressScreen() {
  const router = useRouter()
  const { addresses, isLoading, createAddress, isCreating } = useAddressesController()
  const selectedAddressId = useCheckoutStore((s) => s.selectedAddressId)
  const setSelectedAddressId = useCheckoutStore((s) => s.setSelectedAddressId)
  const [showAddForm, setShowAddForm] = useState(false)

  const onBack = () => router.navigate(USER_ROUTES.CART)
  const onSelectAddress = () => router.push(USER_ROUTES.CHECKOUT_SUMMARY)

  // Default to the buyer's default address the first time this screen sees a real address list.
  // Also repairs a persisted id that points at an address deleted from another screen.
  useEffect(() => {
    if (isLoading || addresses.length === 0) return
    const stillExists = addresses.some((a) => a.id === selectedAddressId)
    if (!selectedAddressId || !stillExists) {
      const defaultAddress = addresses.find((a) => a.isDefault) || addresses[0]
      setSelectedAddressId(defaultAddress.id)
    }
  }, [addresses, isLoading, selectedAddressId, setSelectedAddressId])

  const selectedAddress = addresses.find((a) => a.id === selectedAddressId) || addresses[0]

  const handleCreate = async (values) => {
    const created = await createAddress(values)
    setSelectedAddressId(created.id)
  }

  return (
    <Screen nav contentStyle={styles.content}>
      <CheckoutStepper current={1} />

      <View style={styles.stack}>
        <View style={styles.headerCard}>
          <View style={styles.headerLeft}>
            <Pressable onPress={onBack} style={styles.backBtn} accessibilityLabel="Back">
              <Icon name="HiArrowLeft" size={20} color={colors.slate[700]} />
            </Pressable>
            <Text style={styles.title}>Select Delivery Address</Text>
          </View>
          <Pressable onPress={() => setShowAddForm(true)} style={styles.addBtn}>
            <Icon name="HiPlus" size={16} color={colors.blue[700]} />
            <Text style={styles.addBtnText}>Add New</Text>
          </Pressable>
        </View>

        {isLoading ? (
          <View style={{ gap: 12 }}>
            {[0, 1].map((n) => (
              <View key={n} style={[styles.emptyCard, { gap: 10, alignItems: 'stretch' }]}>
                <Skeleton style={{ height: 14, width: '40%' }} />
                <Skeleton style={{ height: 12, width: '90%' }} />
                <Skeleton style={{ height: 12, width: '65%' }} />
              </View>
            ))}
          </View>
        ) : addresses.length === 0 ? (
          <View style={[styles.emptyCard, { gap: 12 }]}>
            <Text style={styles.emptyTitle}>No saved addresses yet</Text>
            <Pressable onPress={() => setShowAddForm(true)} style={styles.primarySmall}>
              <Text style={styles.primarySmallText}>Add Your First Address</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {addresses.map((item, index) => {
              const isSelected = selectedAddressId === item.id
              return (
                <Animated.View key={item.id} entering={enterFade(index)}>
                <PressableScale
                  scaleTo={0.985}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isSelected }}
                  onPress={() => setSelectedAddressId(item.id)}
                  style={[styles.addrCard, isSelected ? styles.addrCardSelected : styles.addrCardIdle]}
                >
                  <View style={styles.addrTop}>
                    <View style={styles.addrTopLeft}>
                      <View style={[styles.radio, isSelected ? styles.radioOn : styles.radioOff]}>
                        {isSelected ? <Animated.View entering={fadeIn} style={styles.radioDot} /> : null}
                      </View>
                      <Text style={styles.addrType}>{item.type}</Text>
                      {item.isDefault ? (
                        <View style={styles.defaultPill}>
                          <Text style={styles.defaultPillText}>DEFAULT</Text>
                        </View>
                      ) : null}
                    </View>
                    {isSelected ? (
                      <Animated.View entering={fadeIn}>
                        <Icon name="HiCheck" size={20} color={colors.blue[600]} />
                      </Animated.View>
                    ) : null}
                  </View>
                  <View style={styles.addrBody}>
                    <Text style={styles.addrName}>{item.fullName}</Text>
                    <Text style={styles.addrLine}>
                      {item.line1}
                      {item.line2 ? `, ${item.line2}` : ''}, {item.city}, {item.state} - {item.pincode}
                    </Text>
                    <Text style={styles.addrPhone}>{item.phone}</Text>
                  </View>
                </PressableScale>
                </Animated.View>
              )
            })}
          </View>
        )}

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Selected Shipping Destination</Text>

          {selectedAddress ? (
            <View style={styles.destBox}>
              <Text style={styles.destType}>{`${selectedAddress.type} Address`}</Text>
              <Text style={styles.destName}>{selectedAddress.fullName}</Text>
              <Text style={styles.destLine}>
                {selectedAddress.line1}
                {selectedAddress.line2 ? `, ${selectedAddress.line2}` : ''}, {selectedAddress.city}, {selectedAddress.state} -{' '}
                {selectedAddress.pincode}
              </Text>
              <Text style={styles.destPhone}>{selectedAddress.phone}</Text>
            </View>
          ) : (
            <Text style={styles.selectHint}>Select or add an address to continue.</Text>
          )}

          <View style={styles.deliveryNote}>
            <Icon name="HiShieldCheck" size={20} color={colors.emerald[600]} />
            <Text style={styles.deliveryNoteText}>Pan-India Doorstep Delivery with Live Tracking</Text>
          </View>

          <PressableScale
            onPress={() => selectedAddress && onSelectAddress(selectedAddress)}
            disabled={!selectedAddress}
            accessibilityRole="button"
            style={[styles.cta, { backgroundColor: colors.blue[600], opacity: selectedAddress ? 1 : 0.5 }]}
          >
            <Text style={styles.ctaText}>Deliver to this Address</Text>
            <Icon name="HiChevronRight" size={16} color="#fff" />
          </PressableScale>
        </View>
      </View>

      <AddressFormModal
        open={showAddForm}
        onClose={() => setShowAddForm(false)}
        onSubmit={handleCreate}
        isSubmitting={isCreating}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16 },
  stack: { gap: 16 },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.8)',
    ...shadows.xs,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1 },
  backBtn: { padding: 6, borderRadius: 9999 },
  title: { fontSize: 16, lineHeight: 24, fontWeight: '800', color: colors.slate[900], flexShrink: 1 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.blue[50],
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  addBtnText: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: colors.blue[700] },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.slate[200],
    padding: 32,
    alignItems: 'center',
  },
  loadingText: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.slate[400], textAlign: 'center' },
  emptyTitle: { fontSize: 14, lineHeight: 20, fontWeight: '700', color: colors.slate[900] },
  primarySmall: { backgroundColor: colors.blue[600], paddingHorizontal: 16, paddingVertical: 10, borderRadius: 16 },
  primarySmallText: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: '#fff' },
  addrCard: { padding: 16, borderRadius: 16, borderWidth: 1 },
  addrCardSelected: { borderColor: colors.blue[600], backgroundColor: 'rgba(239,246,255,0.4)', ...shadows.md },
  addrCardIdle: { borderColor: colors.slate[200], backgroundColor: '#fff' },
  addrTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  addrTopLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  radio: { width: 20, height: 20, borderRadius: 9999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: colors.blue[600], backgroundColor: colors.blue[600] },
  radioOff: { borderColor: colors.slate[300] },
  radioDot: { width: 8, height: 8, borderRadius: 9999, backgroundColor: '#fff' },
  addrType: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: colors.slate[900], textTransform: 'capitalize' },
  defaultPill: { paddingHorizontal: 8, paddingVertical: 2, backgroundColor: colors.blue[100], borderRadius: 9999 },
  defaultPillText: { fontSize: 9, fontWeight: '800', color: colors.blue[700] },
  addrBody: { paddingLeft: 28, gap: 4 },
  addrName: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: colors.slate[900] },
  addrLine: { fontSize: 12, lineHeight: 19.5, color: colors.slate[600] },
  addrPhone: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.slate[700] },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.8)',
    padding: 20,
    gap: 20,
    ...shadows.md,
  },
  summaryTitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '800',
    color: colors.slate[900],
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
    paddingBottom: 12,
  },
  destBox: {
    backgroundColor: colors.slate[50],
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.6)',
    gap: 8,
  },
  destType: { fontSize: 10, fontWeight: '800', color: colors.blue[700], textTransform: 'uppercase', letterSpacing: 1 },
  destName: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: colors.slate[900] },
  destLine: { fontSize: 12, lineHeight: 19.5, color: colors.slate[600] },
  destPhone: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.slate[800], paddingTop: 4 },
  selectHint: { fontSize: 12, lineHeight: 16, color: colors.slate[500] },
  deliveryNote: {
    backgroundColor: colors.emerald[50],
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.emerald[100],
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deliveryNoteText: { flex: 1, fontSize: 11, lineHeight: 16.5, fontWeight: '600', color: colors.emerald[800] },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 16,
    ...shadows.md,
  },
  ctaText: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: '#fff', letterSpacing: 0.3 },
})
