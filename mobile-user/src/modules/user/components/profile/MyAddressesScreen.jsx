import { useState } from 'react'
import { Pressable, View, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { Screen } from '../../../../components/layout/Screen'
import { Skeleton } from '../../../../components/ui/Skeleton'
import { Text } from '../../../../components/ui/Text'
import { Icon } from '../../../../components/ui/Icon'
import { USER_ROUTES } from '../../../../config/routes'
import { useAddressesController } from '../../controllers/useAddressesController'
import { AddressFormModal } from './AddressFormModal'
import { toast } from '../../../../lib/toast'
import { colors, radius, shadows } from '../../../../theme'

const TYPE_ICONS = { home: 'HiHome', office: 'HiBriefcase', other: 'HiMapPin' }

export function MyAddressesScreen({ onBack }) {
  const router = useRouter()
  const handleBack =
    onBack ||
    (() => {
      if (router.canGoBack()) router.back()
      else router.replace(USER_ROUTES.DASHBOARD)
    })

  const { addresses, isLoading, createAddress, updateAddress, setDefaultAddress, removeAddress, isCreating, isUpdating } =
    useAddressesController()

  const [formState, setFormState] = useState({ open: false, editing: null })

  const openAddForm = () => setFormState({ open: true, editing: null })
  const openEditForm = (address) => setFormState({ open: true, editing: address })
  const closeForm = () => setFormState({ open: false, editing: null })

  const handleSubmit = async (values) => {
    if (formState.editing) {
      const res = await updateAddress({ id: formState.editing.id, ...values })
      toast.success('Address Updated', 'Delivery address details saved.')
      return res
    }
    const res = await createAddress(values)
    toast.success('Address Added', 'New delivery address saved.')
    return res
  }

  const handleSetDefault = async (id) => {
    try {
      await setDefaultAddress(id)
      toast.success('Default Address Set', 'Your primary delivery address was updated.')
    } catch (err) {
      toast.error('Could not set default address', err)
    }
  }

  const handleRemove = async (id) => {
    try {
      await removeAddress(id)
      toast.info('Address Removed', 'The delivery address was deleted.')
    } catch (err) {
      toast.error('Could not delete address', err)
    }
  }

  const header = (
    <View style={styles.appBar}>
      <Pressable onPress={handleBack} accessibilityLabel="Go back" style={styles.backBtn}>
        <Icon name="HiArrowLeft" size={20} color={colors.slate[700]} />
      </Pressable>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 16, lineHeight: 20, fontWeight: '800', color: colors.slate[900] }}>My Addresses</Text>
        {!isLoading && addresses.length > 0 ? (
          <Text style={{ fontSize: 11, fontWeight: '600', color: colors.slate[500] }}>
            <Text noTranslate style={{ fontSize: 11, fontWeight: '600', color: colors.slate[500] }}>
              {addresses.length}
            </Text>
            {` saved ${addresses.length === 1 ? 'address' : 'addresses'}`}
          </Text>
        ) : null}
      </View>
    </View>
  )

  return (
    <Screen header={header}>
      <View style={{ padding: 16, gap: 16 }}>
        {/* Add-address row */}
        {!isLoading && addresses.length > 0 ? (
          <Pressable
            onPress={openAddForm}
            style={({ pressed }) => [styles.addRow, pressed && { backgroundColor: colors.blue[50] }]}
          >
            <View style={styles.addIcon}>
              <Icon name="HiPlus" size={20} color={colors.blue[600]} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.blue[600] }}>Add a new address</Text>
              <Text style={{ fontSize: 11, color: colors.slate[500] }}>Home, office or anywhere else</Text>
            </View>
          </Pressable>
        ) : null}

        {isLoading ? (
          <View style={{ gap: 12 }}>
            {[0, 1].map((i) => (
              <View key={i} style={[styles.card, { padding: 16, gap: 12 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Skeleton style={{ width: 40, height: 40, borderRadius: radius.xl }} />
                  <Skeleton style={{ height: 12, width: 96 }} />
                </View>
                <Skeleton style={{ height: 12, width: '75%' }} />
                <Skeleton style={{ height: 12, width: '50%' }} />
              </View>
            ))}
          </View>
        ) : addresses.length === 0 ? (
          <View style={[styles.card, { borderRadius: radius['3xl'], paddingHorizontal: 24, paddingVertical: 48, alignItems: 'center' }]}>
            <View style={styles.emptyIcon}>
              <Icon name="HiMapPin" size={32} color={colors.blue[600]} />
            </View>
            <Text style={{ fontSize: 16, fontWeight: '800', color: colors.slate[900] }}>No saved addresses yet</Text>
            <Text style={{ fontSize: 12, color: colors.slate[500], marginTop: 4, maxWidth: 320, textAlign: 'center' }}>
              Add a delivery address to speed up checkout.
            </Text>
            <Pressable
              onPress={openAddForm}
              style={({ pressed }) => [styles.emptyBtn, shadows.sm, { backgroundColor: pressed ? colors.blue[700] : colors.blue[600] }]}
            >
              <Icon name="HiPlus" size={16} color="#fff" />
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>Add New Address</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {addresses.map((item) => (
              <View
                key={item.id}
                style={[
                  styles.card,
                  shadows.xs,
                  { overflow: 'hidden' },
                  item.isDefault && { borderColor: colors.blue[500], borderWidth: 2 },
                ]}
              >
                <View style={{ padding: 16, flexDirection: 'row', gap: 12 }}>
                  <View
                    style={[
                      styles.typeIcon,
                      { backgroundColor: item.isDefault ? colors.blue[600] : colors.slate[100] },
                    ]}
                  >
                    <Icon name={TYPE_ICONS[item.type] || 'HiMapPin'} size={20} color={item.isDefault ? '#fff' : colors.slate[600]} />
                  </View>

                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <Text style={{ fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.3, color: colors.slate[500] }}>
                        {item.type}
                      </Text>
                      {item.isDefault ? (
                        <View style={styles.defaultPill}>
                          <Icon name="HiCheckCircle" size={12} color={colors.blue[700]} />
                          <Text style={{ fontSize: 10, fontWeight: '800', textTransform: 'uppercase', color: colors.blue[700] }}>Default</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text noTranslate numberOfLines={1} style={{ marginTop: 4, fontSize: 15, fontWeight: '700', color: colors.slate[900] }}>
                      {item.fullName}
                    </Text>
                    <Text noTranslate style={{ marginTop: 4, fontSize: 13, lineHeight: 21, color: colors.slate[600] }}>
                      {item.line1}
                      {item.line2 ? `, ${item.line2}` : ''}, {item.city}, {item.state} - {item.pincode}
                    </Text>
                    <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Icon name="HiPhone" size={14} color={colors.slate[400]} />
                      <Text noTranslate style={{ fontSize: 13, fontWeight: '600', color: colors.slate[700] }}>
                        {item.phone}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.actions}>
                  <Pressable onPress={() => openEditForm(item)} style={({ pressed }) => [styles.action, pressed && { backgroundColor: colors.slate[50] }]}>
                    <Icon name="HiPencil" size={16} color={colors.slate[600]} />
                    <Text style={styles.actionText}>Edit</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleRemove(item.id)}
                    style={({ pressed }) => [styles.action, styles.actionBorder, pressed && { backgroundColor: colors.red[50] }]}
                  >
                    <Icon name="HiTrash" size={16} color={colors.slate[600]} />
                    <Text style={styles.actionText}>Remove</Text>
                  </Pressable>
                  {item.isDefault ? (
                    <View style={[styles.action, styles.actionBorder]}>
                      <Icon name="HiCheckCircle" size={16} color="rgba(37,99,235,0.7)" />
                      <Text style={{ fontSize: 12, fontWeight: '600', color: 'rgba(37,99,235,0.7)' }}>Default</Text>
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => handleSetDefault(item.id)}
                      style={({ pressed }) => [styles.action, styles.actionBorder, pressed && { backgroundColor: colors.blue[50] }]}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.blue[600] }}>Set Default</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      <AddressFormModal
        open={formState.open}
        initialValues={formState.editing}
        onClose={closeForm}
        onSubmit={handleSubmit}
        isSubmitting={isCreating || isUpdating}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  appBar: {
    height: 56,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(226,232,240,0.8)',
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 9999 },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.blue[300],
    borderRadius: radius['2xl'],
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  addIcon: { width: 36, height: 36, borderRadius: radius.xl, backgroundColor: colors.blue[50], alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: '#fff', borderRadius: radius['2xl'], borderWidth: 1, borderColor: 'rgba(226,232,240,0.8)' },
  emptyIcon: { width: 64, height: 64, borderRadius: 9999, backgroundColor: colors.blue[50], alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyBtn: { marginTop: 20, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 12, borderRadius: radius.xl },
  typeIcon: { width: 40, height: 40, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center' },
  defaultPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: colors.blue[50],
    borderRadius: 9999,
  },
  actions: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.slate[100] },
  action: { flex: 1, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  actionBorder: { borderLeftWidth: 1, borderLeftColor: colors.slate[100] },
  actionText: { fontSize: 12, fontWeight: '700', color: colors.slate[600] },
})
