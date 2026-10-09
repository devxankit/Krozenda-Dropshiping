import { useEffect, useState } from 'react'
import { Image, Pressable, ScrollView, View, StyleSheet } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { Screen } from '../../../../components/layout/Screen'
import { Sheet } from '../../../../components/ui/Sheet'
import { Text } from '../../../../components/ui/Text'
import { Icon } from '../../../../components/ui/Icon'
import { ListSkeleton } from '../../../../components/ui/AsyncBoundary'
import { SmartImage } from '../../../../components/ui/SmartImage'
import { USER_ROUTES } from '../../../../config/routes'
import { useReturnsController } from '../../controllers/useReturnsController'
import { toast } from '../../../../lib/toast'
import { colors, radius, shadows } from '../../../../theme'

const MAX_PHOTOS = 4

const RETURN_REASONS = [
  'Damaged Product received',
  'Defective / Not Working',
  'Wrong Item Delivered',
  'Missing Product Accessories',
  'Quality Not as Expected',
  'Other',
]

const STATUS_META = {
  PENDING: { label: 'Pending Review', bg: colors.amber[50], fg: colors.amber[700], border: colors.amber[200], icon: 'HiClock' },
  // Approved; the item is on its way back. Money / replacement follow once it arrives.
  ACCEPTED: { label: 'Approved — pickup in progress', bg: colors.blue[50], fg: colors.blue[700], border: colors.blue[200], icon: 'HiClock' },
  APPROVED: { label: 'Completed', bg: colors.emerald[50], fg: colors.emerald[700], border: colors.emerald[200], icon: 'HiCheckCircle' },
  REJECTED: { label: 'Rejected', bg: colors.red[50], fg: colors.red[700], border: colors.red[200], icon: 'HiXCircle' },
}

// One order line: two variants of one product are two returnable lines.
const lineKey = (item) => `${item.orderId}:${item.productId}:${item.variantId || ''}`

export function ReturnReplacementScreen({ onBack, onContinue }) {
  const router = useRouter()
  const { orderId: targetOrderId } = useLocalSearchParams()

  const handleBack =
    onBack ||
    (() => {
      if (router.canGoBack()) router.back()
      else router.replace(USER_ROUTES.DASHBOARD)
    })
  const handleContinue = onContinue || (() => router.push(USER_ROUTES.ORDERS))
  const { items, isLoading, submitReturnRequest, isSubmitting, error } = useReturnsController()

  const [selectedKey, setSelectedKey] = useState('')
  const [requestType, setRequestType] = useState('REPLACEMENT')
  const [selectedReason, setSelectedReason] = useState(RETURN_REASONS[0])
  const [photos, setPhotos] = useState([])
  const [submitted, setSubmitted] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)

  useEffect(() => {
    if (items.length > 0) {
      if (targetOrderId) {
        const found = items.find((item) => item.orderId === targetOrderId)
        if (found) {
          // eslint-disable-next-line react-hooks/set-state-in-effect -- preselect the line for ?orderId once items load
          setSelectedKey(lineKey(found))
          return
        }
      }
      if (!selectedKey) {
        setSelectedKey(lineKey(items[0]))
      }
    }
  }, [items, targetOrderId, selectedKey])

  const selectedItem = items.find((item) => lineKey(item) === selectedKey)
  // Any request that is not rejected blocks another on the same line.
  const lockedStatus =
    selectedItem?.existingRequest && selectedItem.existingRequest.status !== 'REJECTED'
      ? selectedItem.existingRequest.status
      : null

  const handlePickPhotos = async () => {
    const remaining = MAX_PHOTOS - photos.length
    if (remaining <= 0) return
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: remaining,
        quality: 0.9,
      })
      if (result.canceled) return
      const next = result.assets.slice(0, remaining).map((asset, i) => {
        const type = asset.mimeType || 'image/jpeg'
        const ext = type.split('/')[1] || 'jpg'
        return {
          previewUrl: asset.uri,
          file: { uri: asset.uri, name: asset.fileName || `return-${Date.now()}-${i}.${ext}`, type },
        }
      })
      setPhotos((prev) => [...prev, ...next])
    } catch (err) {
      toast.error('Could not open your photos', err)
    }
  }

  const handleRemovePhoto = (index) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    if (!selectedItem || lockedStatus || selectedItem.returnEligible === false) return
    setSubmitted(false)
    let request
    try {
      request = await submitReturnRequest({
        orderId: selectedItem.orderId,
        productId: selectedItem.productId,
        variantId: selectedItem.variantId,
        requestType,
        reason: selectedReason,
        photoFiles: photos.map((p) => p.file),
      })
    } catch (err) {
      toast.error('Submission Failed', err)
      return
    }
    // Outside the try: the request is already saved, so nothing after this point may report it
    // as a failed submission.
    setPhotos([])
    setSubmitted(true)
    toast.success('Request Submitted', 'Your return or replacement claim has been submitted.')
    handleContinue(request)
  }

  const itemLabel = (item) => `${item.name}${item.variant ? ` (${item.variant})` : ''} — Order #${item.orderId.slice(-8).toUpperCase()}`
  const lockedMeta = lockedStatus ? STATUS_META[lockedStatus] : null

  return (
    <Screen>
      <View style={{ padding: 16, gap: 24 }}>
        <View style={[styles.card, shadows.xs, { padding: 24, flexDirection: 'row', alignItems: 'center', gap: 16 }]}>
          <Pressable onPress={handleBack} accessibilityLabel="Go back" style={{ padding: 8, borderRadius: 9999 }}>
            <Icon name="HiArrowLeft" size={20} color={colors.slate[700]} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 20, lineHeight: 28, fontWeight: '800', color: colors.slate[900] }}>Request Return or Replacement</Text>
            <Text style={{ fontSize: 12, color: colors.slate[500], marginTop: 2 }}>
              Submit a hassle-free replacement or refund claim on a delivered order.
            </Text>
          </View>
        </View>

        {isLoading ? (
          <ListSkeleton count={3} />
        ) : items.length === 0 ? (
          <View style={[styles.card, { padding: 40, borderStyle: 'dashed', borderColor: colors.slate[300], gap: 4 }]}>
            <Text style={{ textAlign: 'center', fontSize: 14, fontWeight: '700', color: colors.slate[700] }}>No delivered orders yet</Text>
            <Text style={{ textAlign: 'center', fontSize: 12, color: colors.slate[500] }}>
              Once an order is delivered, you can request a return or replacement here.
            </Text>
          </View>
        ) : (
          <View style={{ gap: 24 }}>
            {/* Item selector */}
            <View style={[styles.card, shadows.xs, { padding: 24, gap: 12 }]}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.slate[900] }}>Select a delivered item</Text>
              <Pressable onPress={() => setPickerOpen(true)} style={styles.select}>
                <Text noTranslate numberOfLines={1} style={{ flex: 1, fontSize: 12, fontWeight: '600', color: colors.slate[900] }}>
                  {selectedItem ? itemLabel(selectedItem) : ''}
                </Text>
                <Icon name="HiChevronDown" size={16} color={colors.slate[400]} />
              </Pressable>

              {selectedItem ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingTop: 8 }}>
                  <View style={styles.itemImg}>
                    <SmartImage src={selectedItem.image || '/images/placeholder.png'} alt={selectedItem.name} ratio={1} fit="contain" style={{ width: '100%', height: '100%' }} />
                  </View>
                  <View>
                    <Text noTranslate style={{ fontSize: 14, fontWeight: '800', color: colors.blue[700] }}>
                      ₹{selectedItem.price.toLocaleString('en-IN')}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.slate[500] }}>
                      {'Qty '}
                      <Text noTranslate style={{ fontSize: 11, color: colors.slate[500] }}>
                        {selectedItem.quantity}
                      </Text>
                    </Text>
                  </View>
                </View>
              ) : null}

              {lockedMeta ? (
                <View style={[styles.banner, { backgroundColor: lockedMeta.bg, borderColor: lockedMeta.border }]}>
                  <Icon name={lockedMeta.icon} size={16} color={lockedMeta.fg} />
                  <Text style={{ flex: 1, fontSize: 12, fontWeight: '700', color: lockedMeta.fg }}>
                    {`A ${selectedItem.existingRequest.requestType.toLowerCase()} request for this item is ${lockedMeta.label.toLowerCase()}.`}
                  </Text>
                </View>
              ) : null}

              {selectedItem && selectedItem.returnEligible === false && !lockedStatus ? (
                <View style={[styles.banner, { backgroundColor: colors.amber[50], borderColor: colors.amber[200] }]}>
                  <Icon name="HiClock" size={16} color={colors.amber[800]} />
                  <Text style={{ flex: 1, fontSize: 12, fontWeight: '700', color: colors.amber[800] }}>
                    The 7-day return window for this item has expired.
                  </Text>
                </View>
              ) : null}
            </View>

            {!lockedStatus ? (
              <>
                <View style={[styles.card, shadows.xs, { padding: 24, gap: 16 }]}>
                  <Text style={styles.sectionTitle}>1. Select Action Required</Text>
                  <View style={{ flexDirection: 'row', gap: 16 }}>
                    {[
                      { id: 'REPLACEMENT', icon: 'HiArrowPath', bg: colors.blue[600], title: 'Replacement', sub: 'Get a replacement unit' },
                      { id: 'REFUND', icon: 'HiBanknotes', bg: colors.emerald[600], title: 'Full Refund', sub: 'Refund credited to Krozenda Wallet' },
                    ].map((opt) => {
                      const active = requestType === opt.id
                      return (
                        <Pressable
                          key={opt.id}
                          onPress={() => setRequestType(opt.id)}
                          style={[
                            styles.option,
                            active
                              ? [{ borderColor: colors.blue[600], backgroundColor: 'rgba(239,246,255,0.4)', borderWidth: 2 }, shadows.md]
                              : { borderColor: colors.slate[200] },
                          ]}
                        >
                          <View style={[styles.optionIcon, { backgroundColor: opt.bg }]}>
                            <Icon name={opt.icon} size={20} color="#fff" />
                          </View>
                          <Text style={{ fontSize: 14, fontWeight: '700', color: colors.slate[900], marginTop: 10 }}>{opt.title}</Text>
                          <Text style={{ fontSize: 12, color: colors.slate[500] }}>{opt.sub}</Text>
                        </Pressable>
                      )
                    })}
                  </View>
                </View>

                <View style={[styles.card, shadows.xs, { padding: 24, gap: 16 }]}>
                  <Text style={styles.sectionTitle}>2. Reason for Claim</Text>
                  <View style={{ gap: 10 }}>
                    {RETURN_REASONS.map((reason) => {
                      const isSelected = selectedReason === reason
                      return (
                        <Pressable
                          key={reason}
                          onPress={() => setSelectedReason(reason)}
                          style={[
                            styles.reason,
                            isSelected
                              ? { borderColor: colors.blue[600], backgroundColor: 'rgba(239,246,255,0.4)' }
                              : { borderColor: colors.slate[200] },
                          ]}
                        >
                          <Text style={{ fontSize: 12, fontWeight: isSelected ? '700' : '400', color: isSelected ? colors.slate[900] : colors.slate[700] }}>
                            {reason}
                          </Text>
                          <View style={[styles.radio, isSelected ? { borderColor: colors.blue[600], backgroundColor: colors.blue[600] } : { borderColor: colors.slate[300] }]}>
                            {isSelected ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' }} /> : null}
                          </View>
                        </Pressable>
                      )
                    })}
                  </View>
                </View>

                <View style={[styles.card, shadows.xs, { padding: 24, gap: 10 }]}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.slate[900] }}>
                    {'Add Photos '}
                    <Text noTranslate style={{ fontSize: 12, fontWeight: '400', color: colors.slate[400] }}>
                      ({photos.length}/{MAX_PHOTOS})
                    </Text>
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingTop: 4, paddingRight: 4 }}>
                    {photos.map((photo, index) => (
                      <View key={photo.previewUrl} style={styles.photo}>
                        <Image source={{ uri: photo.previewUrl }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                        <Pressable onPress={() => handleRemovePhoto(index)} style={styles.photoX}>
                          <Icon name="HiXMark" size={12} color="#fff" />
                        </Pressable>
                      </View>
                    ))}
                    {photos.length < MAX_PHOTOS ? (
                      <Pressable onPress={handlePickPhotos} style={styles.addPhoto}>
                        <Icon name="HiPlus" size={24} color={colors.slate[400]} />
                      </Pressable>
                    ) : null}
                  </ScrollView>
                </View>

                {/* Claim overview */}
                <View style={[styles.card, shadows.md, { padding: 24, gap: 20 }]}>
                  <Text style={[styles.sectionTitle, { fontSize: 16 }]}>Claim Overview</Text>

                  <View style={{ gap: 12 }}>
                    <View style={styles.row}>
                      <Text style={styles.rowLabel}>Request Type:</Text>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.blue[700] }}>{requestType === 'REFUND' ? 'Full Refund' : 'Replacement'}</Text>
                    </View>
                    <View style={styles.row}>
                      <Text style={styles.rowLabel}>Claim Reason:</Text>
                      <Text style={{ flex: 1, textAlign: 'right', fontSize: 12, fontWeight: '700', color: colors.slate[900] }}>{selectedReason}</Text>
                    </View>
                    {requestType === 'REFUND' && selectedItem ? (
                      <View style={[styles.row, { paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.slate[100] }]}>
                        <Text style={styles.rowLabel}>Refund Amount:</Text>
                        <Text noTranslate style={{ fontSize: 12, fontWeight: '700', color: colors.emerald[600] }}>
                          ₹{(selectedItem.price * selectedItem.quantity).toLocaleString('en-IN')}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.guarantee}>
                    <Icon name="HiShieldCheck" size={20} color={colors.emerald[600]} />
                    <Text style={{ flex: 1, fontSize: 11, fontWeight: '600', color: colors.emerald[800] }}>Protected by Krozenda Buyer Guarantee</Text>
                  </View>

                  {error ? <Text style={{ fontSize: 12, fontWeight: '600', color: colors.red[600] }}>{error.message}</Text> : null}
                  {submitted ? (
                    <View style={[styles.banner, { backgroundColor: colors.emerald[50], borderColor: colors.emerald[200] }]}>
                      <Icon name="HiCheckCircle" size={16} color={colors.emerald[700]} />
                      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.emerald[700] }}>Request submitted successfully</Text>
                    </View>
                  ) : null}

                  <Pressable
                    onPress={handleSubmit}
                    disabled={isSubmitting || !selectedItem || selectedItem.returnEligible === false}
                    style={({ pressed }) => [
                      styles.submit,
                      shadows.lg,
                      {
                        backgroundColor: pressed ? colors.blue[800] : colors.blue[700],
                        opacity: isSubmitting || !selectedItem || selectedItem.returnEligible === false ? 0.6 : 1,
                      },
                    ]}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff', letterSpacing: 0.3 }}>
                      {selectedItem?.returnEligible === false ? 'Return Window Expired' : isSubmitting ? 'Submitting...' : 'Submit Return Claim →'}
                    </Text>
                  </Pressable>
                </View>
              </>
            ) : null}
          </View>
        )}
      </View>

      {/* Item picker (native replacement for the web <select>) */}
      <Sheet visible={pickerOpen} onClose={() => setPickerOpen(false)} maxHeight="70%">
        <View style={styles.pickerHead}>
          <Text style={{ fontSize: 14, fontWeight: '800', color: colors.slate[900] }}>Select a delivered item</Text>
          <Pressable onPress={() => setPickerOpen(false)} style={{ padding: 6, borderRadius: 9999 }}>
            <Icon name="HiXMark" size={20} color={colors.slate[500]} />
          </Pressable>
        </View>
        <ScrollView>
          {items.map((item) => {
            const active = lineKey(item) === selectedKey
            return (
              <Pressable
                key={lineKey(item)}
                onPress={() => {
                  setSelectedKey(lineKey(item))
                  setPickerOpen(false)
                }}
                style={[styles.pickerRow, active && { backgroundColor: colors.blue[50] }]}
              >
                <Text noTranslate style={{ fontSize: 12, fontWeight: active ? '700' : '600', color: colors.slate[900] }}>
                  {itemLabel(item)}
                </Text>
              </Pressable>
            )
          })}
        </ScrollView>
      </Sheet>
    </Screen>
  )
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: radius['3xl'], borderWidth: 1, borderColor: 'rgba(226,232,240,0.8)' },
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.slate[200],
    backgroundColor: colors.slate[50],
  },
  itemImg: { width: 64, height: 64, backgroundColor: colors.slate[50], borderRadius: radius['2xl'], padding: 8, borderWidth: 1, borderColor: colors.slate[100], overflow: 'hidden' },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.xl, borderWidth: 1 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: colors.slate[900], borderBottomWidth: 1, borderBottomColor: colors.slate[100], paddingBottom: 12 },
  option: { flex: 1, padding: 16, borderRadius: radius['2xl'], borderWidth: 1 },
  optionIcon: { width: 40, height: 40, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center' },
  reason: { padding: 16, borderRadius: radius['2xl'], borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  radio: { width: 16, height: 16, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  photo: { width: 56, height: 56, backgroundColor: colors.slate[50], borderWidth: 1, borderColor: colors.slate[200], borderRadius: radius.xl, padding: 2, overflow: 'visible' },
  photoX: { position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: 8, backgroundColor: 'rgba(15,23,42,0.8)', alignItems: 'center', justifyContent: 'center' },
  addPhoto: { width: 56, height: 56, borderRadius: radius.xl, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.slate[300], alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  rowLabel: { fontSize: 12, fontWeight: '500', color: colors.slate[500] },
  guarantee: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14, borderRadius: radius['2xl'], backgroundColor: colors.emerald[50], borderWidth: 1, borderColor: colors.emerald[100] },
  submit: { width: '100%', paddingVertical: 16, paddingHorizontal: 16, borderRadius: radius['2xl'], alignItems: 'center' },
  pickerHead: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerRow: { paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.slate[100] },
})
