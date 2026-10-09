import { useState } from 'react'
import { View, Pressable, TextInput, ScrollView, Image, StyleSheet } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { Screen } from '../../../../components/layout/Screen'
import { Text } from '../../../../components/ui/Text'
import { Animated, usePop } from '../../../../components/ui/motion'
import { Icon } from '../../../../components/ui/Icon'
import { ListSkeleton } from '../../../../components/ui/AsyncBoundary'
import { SmartImage } from '../../../../components/ui/SmartImage'
import { Sheet } from '../../../../components/ui/Sheet'
import { toast } from '../../../../lib/toast'
import { USER_ROUTES } from '../../../../config/routes'
import { colors, fonts, shadows } from '../../../../theme'
import { useSubmitReviewController } from '../../controllers/useSubmitReviewController'
import { useReviewableItemsController } from '../../controllers/useReviewableItemsController'

const MAX_PHOTOS = 4
// Matches the backend's multer limit. Checked here so an oversized photo is rejected before it is
// uploaded rather than after a slow failed request.
const MAX_PHOTO_BYTES = 10 * 1024 * 1024
const ACCEPTED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']

const ratingLabels = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent']

// One tappable star; the star just chosen pops (UI thread) so the tap has visible feedback.
function StarButton({ star, rating, onSelect }) {
  const pop = usePop(star === rating ? rating : undefined)
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={`${star} star${star === 1 ? '' : 's'}`}
      accessibilityState={{ selected: star === rating }}
      onPress={() => onSelect(star)}
      style={{ padding: 6 }}
    >
      <Animated.View style={pop}>
        <Icon name="HiStar" size={32} color={star <= rating ? colors.amber[400] : colors.slate[200]} />
      </Animated.View>
    </Pressable>
  )
}

export function RateReviewScreen() {
  const router = useRouter()
  // Optional: /orders/:orderId/review pre-selects that order's item, /reviews shows the full picker.
  const { orderId: orderIdFromPath } = useLocalSearchParams()
  const { items, isLoading } = useReviewableItemsController()

  const onBack = () => router.navigate(USER_ROUTES.ORDERS)
  const onSubmitReview = () => router.navigate(USER_ROUTES.ORDERS)
  const { submitReview, isSubmitting, isError, error } = useSubmitReviewController()

  const [selectedProductId, setSelectedProductId] = useState(null)
  const [rating, setRating] = useState(5)
  const [reviewText, setReviewText] = useState('')
  const [photos, setPhotos] = useState([]) // [{ uri, name, type, size }]
  const [photoError, setPhotoError] = useState(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  // Default to the item from the order in the URL when there is one, otherwise the first
  // not-yet-reviewed item. Done as a render-phase adjustment so the form paints once, populated.
  const resolvedProductId = (() => {
    if (selectedProductId || items.length === 0) return selectedProductId
    const fromOrder = orderIdFromPath && items.find((i) => i.orderId === orderIdFromPath)
    const firstUnreviewed = items.find((i) => !i.alreadyReviewed) || items[0]
    return (fromOrder || firstUnreviewed).productId
  })()

  if (resolvedProductId !== selectedProductId && resolvedProductId) {
    setSelectedProductId(resolvedProductId)
  }

  const selectedItem = items.find((i) => i.productId === resolvedProductId) || null

  // Load the picked product's existing review into the form (edit mode), or reset to defaults for
  // a fresh review. Keyed on the product id so switching products re-seeds the form, while typing
  // in it does not.
  const [formSeededFor, setFormSeededFor] = useState(null)
  if (selectedItem && formSeededFor !== selectedItem.productId) {
    setFormSeededFor(selectedItem.productId)
    setRating(selectedItem.myReview?.rating ?? 5)
    setReviewText(selectedItem.myReview?.reviewText ?? '')
    setPhotos([])
    setPhotoError(null)
  }

  // Photo picking has more failure modes than the happy path: the user cancels the picker, the
  // gallery hands back a file the server will not take, or a huge photo blows the upload limit.
  // Each is caught here, with a message, rather than as a failed request seconds later.
  const handlePickPhotos = async () => {
    setPhotoError(null)
    const room = MAX_PHOTOS - photos.length
    if (room <= 0) {
      setPhotoError(`You can attach up to ${MAX_PHOTOS} photos.`)
      return
    }

    let result
    try {
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: room,
        quality: 0.9,
      })
    } catch (err) {
      setPhotoError(err?.message || 'Could not open your photos.')
      return
    }
    if (result.canceled || !result.assets?.length) return // user cancelled - not an error

    const picked = result.assets
    const rejected = []
    const accepted = []

    for (const asset of picked.slice(0, room)) {
      const name = asset.fileName || asset.uri.split('/').pop() || 'photo.jpg'
      const type = asset.mimeType || 'image/jpeg'
      if (asset.fileSize && asset.fileSize > MAX_PHOTO_BYTES) {
        rejected.push(`${name} is larger than 10MB`)
      } else if (type && !ACCEPTED_PHOTO_TYPES.includes(type)) {
        rejected.push(`${name} is not a supported image`)
      } else {
        accepted.push({ uri: asset.uri, name, type })
      }
    }

    if (picked.length > room) {
      rejected.push(`only ${room} more photo${room === 1 ? '' : 's'} can be added`)
    }

    if (accepted.length > 0) setPhotos((prev) => [...prev, ...accepted])
    if (rejected.length > 0) setPhotoError(`Some photos were not added: ${rejected.join(', ')}.`)
  }

  const handleRemovePhoto = (index) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index))
    setPhotoError(null)
  }

  const handleSubmit = async () => {
    // Guarded against a double tap: a second tap can land before React re-renders.
    if (!selectedItem || isSubmitting) return
    try {
      const review = await submitReview({
        productId: selectedItem.productId,
        orderId: selectedItem.orderId,
        rating,
        reviewText,
        // React Native's FormData takes { uri, name, type } descriptors in place of File objects.
        photoFiles: photos.map((photo) => ({ uri: photo.uri, name: photo.name, type: photo.type })),
      })
      toast.success('Review Submitted', 'Thank you for your valuable feedback!')
      onSubmitReview(review)
    } catch (err) {
      toast.error('Could not submit review', err)
    }
  }

  const header = (
    <View style={styles.headerBar}>
      <Pressable onPress={onBack} accessibilityLabel="Go back" style={styles.backBtn}>
        <Icon name="HiArrowLeft" size={20} color={colors.slate[700]} />
      </Pressable>
      <Text style={styles.headerTitle}>Rate & Review</Text>
    </View>
  )

  return (
    <Screen nav activeTab="orders" header={header} keyboard contentStyle={{ padding: 16, gap: 16 }}>
      {isLoading ? (
        <ListSkeleton count={3} />
      ) : items.length === 0 ? (
        <View style={[styles.card, styles.centerCard, { gap: 8 }]}>
          <Icon name="HiChatBubbleLeftRight" size={32} color={colors.slate[300]} />
          <Text style={styles.emptyTitle}>No delivered products to review yet</Text>
          <Text style={styles.emptySub}>Once an order is delivered, it’ll show up here for review.</Text>
        </View>
      ) : (
        <>
          {/* Delivered products dropdown */}
          <View style={[styles.card, { gap: 8 }]}>
            <Text style={styles.fieldLabel}>Select a delivered product</Text>
            <Pressable onPress={() => setPickerOpen(true)} style={styles.select} accessibilityRole="button">
              <Text noTranslate numberOfLines={1} style={styles.selectText}>
                {selectedItem
                  ? `${selectedItem.name} — ${selectedItem.reviewsCount} review${selectedItem.reviewsCount === 1 ? '' : 's'}${
                      selectedItem.alreadyReviewed ? ' (you reviewed this)' : ''
                    }`
                  : ''}
              </Text>
              <Icon name="HiChevronRight" size={16} color={colors.slate[400]} style={{ transform: [{ rotate: '90deg' }] }} />
            </Pressable>
          </View>

          {selectedItem ? (
            <>
              {/* Delivered Product Card */}
              <View style={[styles.card, { gap: 12 }]}>
                <View style={styles.rowBetween}>
                  <Text noTranslate style={styles.deliveredOn}>
                    {`DELIVERED ON ${new Date(selectedItem.deliveredAt)
                      .toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                      .toUpperCase()}`}
                  </Text>
                  <Text noTranslate style={styles.reviewsCount}>
                    {`${selectedItem.reviewsCount} review${selectedItem.reviewsCount === 1 ? '' : 's'}`}
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={styles.productImg}>
                    <SmartImage src={selectedItem.image} alt={selectedItem.name} ratio="1 / 1" style={{ width: '100%', height: '100%' }} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text noTranslate style={styles.productName}>
                      {selectedItem.name}
                    </Text>
                    <Text noTranslate style={styles.productPrice}>
                      {`₹${selectedItem.price.toLocaleString('en-IN')}`}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Star Rating Section */}
              <View style={[styles.card, { alignItems: 'center', gap: 12, padding: 20 }]}>
                <Text style={styles.ratingTitle}>
                  {selectedItem.alreadyReviewed ? 'Update your rating' : 'How would you rate this product?'}
                </Text>

                <View style={styles.starsRow} accessibilityRole="radiogroup">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <StarButton key={star} star={star} rating={rating} onSelect={setRating} />
                  ))}
                </View>

                <Text style={styles.ratingLabel}>{ratingLabels[rating]}</Text>
              </View>

              {/* Review Text Input Section */}
              <View style={[styles.card, { gap: 8 }]}>
                <View style={styles.rowBetween}>
                  <Text style={styles.reviewHeading}>
                    Write a Review <Text style={styles.optional}>(Optional)</Text>
                  </Text>
                  <Text noTranslate style={styles.counter}>{`${reviewText.length}/500`}</Text>
                </View>

                <TextInput
                  multiline
                  numberOfLines={4}
                  maxLength={500}
                  accessibilityLabel="Your review"
                  placeholder="Write your detailed review here..."
                  placeholderTextColor={colors.slate[400]}
                  value={reviewText}
                  onChangeText={setReviewText}
                  textAlignVertical="top"
                  style={styles.textarea}
                />
              </View>

              {/* Add Photos Section */}
              <View style={[styles.card, { gap: 10 }]}>
                <Text style={styles.reviewHeading}>
                  Add Photos <Text style={styles.optional}>{`(${photos.length}/${MAX_PHOTOS})`}</Text>
                </Text>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingTop: 4, paddingRight: 4 }}>
                  {photos.map((photo, index) => (
                    <View key={photo.uri} style={styles.photoBox}>
                      <Image source={{ uri: photo.uri }} style={{ width: '100%', height: '100%' }} resizeMode="contain" accessibilityLabel={`Selected photo ${index + 1}`} />
                      <Pressable onPress={() => handleRemovePhoto(index)} accessibilityLabel="Remove photo" style={styles.photoRemove}>
                        <Icon name="HiXMark" size={12} color="#fff" />
                      </Pressable>
                    </View>
                  ))}

                  {photos.length < MAX_PHOTOS ? (
                    <Pressable onPress={handlePickPhotos} accessibilityLabel="Add photo" style={styles.addPhoto}>
                      <Icon name="HiPlus" size={24} color={colors.slate[400]} />
                    </Pressable>
                  ) : null}
                </ScrollView>

                {photoError ? <Text style={styles.photoError}>{photoError}</Text> : null}
                {selectedItem.alreadyReviewed && photos.length === 0 ? (
                  <Text style={styles.keepNote}>Leave photos empty to keep your previously uploaded ones.</Text>
                ) : null}
              </View>

              {isError ? (
                <View style={styles.errorToast}>
                  <Text style={styles.errorToastText}>{error?.message ?? 'Could not submit your review. Please try again.'}</Text>
                </View>
              ) : null}

              <Pressable
                onPress={handleSubmit}
                disabled={isSubmitting}
                style={({ pressed }) => [
                  styles.cta,
                  { backgroundColor: pressed ? colors.blue[700] : colors.blue[600], opacity: isSubmitting ? 0.6 : 1 },
                ]}
              >
                <Text style={styles.ctaText}>
                  {isSubmitting ? 'Submitting...' : selectedItem.alreadyReviewed ? 'Update Review' : 'Submit Review'}
                </Text>
              </Pressable>
            </>
          ) : null}
        </>
      )}

      {/* Native replacement for the web <select>. */}
      <Sheet visible={pickerOpen} onClose={() => setPickerOpen(false)} maxHeight="70%">
        <View style={styles.sheetHead}>
          <Text style={styles.sheetTitle}>Select a delivered product</Text>
        </View>
        <ScrollView>
          {items.map((item) => {
            const active = item.productId === resolvedProductId
            return (
              <Pressable
                key={item.productId}
                onPress={() => {
                  setSelectedProductId(item.productId)
                  setPickerOpen(false)
                }}
                style={[styles.option, active && { backgroundColor: colors.blue[50] }]}
              >
                <Text noTranslate style={[styles.optionText, active && { color: colors.blue[700] }]}>
                  {`${item.name} — ${item.reviewsCount} review${item.reviewsCount === 1 ? '' : 's'}${
                    item.alreadyReviewed ? ' (you reviewed this)' : ''
                  }`}
                </Text>
                {active ? <Icon name="HiCheck" size={16} color={colors.blue[600]} /> : null}
              </Pressable>
            )
          })}
        </ScrollView>
      </Sheet>
    </Screen>
  )
}

const styles = StyleSheet.create({
  headerBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[200],
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    ...shadows.xs,
  },
  backBtn: { padding: 6, borderRadius: 9999 },
  headerTitle: { fontSize: 16, lineHeight: 24, fontWeight: '700', color: colors.slate[900] },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.8)',
    padding: 16,
    ...shadows.xs,
  },
  centerCard: { padding: 40, alignItems: 'center' },
  loadingText: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.slate[400], textAlign: 'center' },
  emptyTitle: { fontSize: 14, lineHeight: 20, fontWeight: '700', color: colors.slate[900], textAlign: 'center' },
  emptySub: { fontSize: 12, lineHeight: 16, color: colors.slate[500], textAlign: 'center' },
  fieldLabel: { fontSize: 11, lineHeight: 16.5, fontWeight: '700', color: colors.slate[500] },
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.slate[50],
    borderWidth: 1,
    borderColor: colors.slate[200],
    borderRadius: 12,
  },
  selectText: { flex: 1, fontSize: 12, lineHeight: 16, fontWeight: '700', color: colors.slate[900] },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  deliveredOn: { fontSize: 10, lineHeight: 15, fontWeight: '700', color: colors.slate[400], letterSpacing: 1 },
  reviewsCount: { fontSize: 10, lineHeight: 15, fontWeight: '700', color: colors.blue[600] },
  productImg: {
    width: 64,
    height: 64,
    backgroundColor: colors.slate[50],
    borderRadius: 12,
    padding: 6,
    borderWidth: 1,
    borderColor: colors.slate[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  productName: { fontSize: 12, lineHeight: 16.5, fontWeight: '700', color: colors.slate[900] },
  productPrice: { marginTop: 4, fontSize: 12, lineHeight: 16, fontWeight: '800', color: colors.slate[900] },
  ratingTitle: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: colors.slate[900] },
  starsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  ratingLabel: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: colors.amber[600] },
  reviewHeading: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: colors.slate[900] },
  optional: { fontSize: 12, fontWeight: '400', color: colors.slate[400] },
  counter: { fontSize: 10, lineHeight: 15, color: colors.slate[400] },
  textarea: {
    minHeight: 96,
    padding: 12,
    backgroundColor: colors.slate[50],
    borderWidth: 1,
    borderColor: colors.slate[200],
    borderRadius: 12,
    fontSize: 12,
    fontFamily: fonts[500],
    color: colors.slate[800],
  },
  photoBox: {
    width: 56,
    height: 56,
    backgroundColor: colors.slate[50],
    borderWidth: 1,
    borderColor: colors.slate[200],
    borderRadius: 12,
    padding: 2,
  },
  photoRemove: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 9999,
    backgroundColor: 'rgba(15,23,42,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhoto: {
    width: 56,
    height: 56,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.slate[300],
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoError: { fontSize: 11, lineHeight: 16, color: colors.red[600] },
  keepNote: { fontSize: 10, lineHeight: 15, color: colors.slate[400] },
  errorToast: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    backgroundColor: colors.red[50],
    paddingHorizontal: 16,
    paddingVertical: 12,
    ...shadows.raised,
  },
  errorToastText: { fontSize: 14, lineHeight: 20, color: colors.red[700] },
  cta: { alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, ...shadows.md },
  ctaText: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: '#fff', letterSpacing: 0.3 },
  sheetHead: { padding: 16, borderBottomWidth: 1, borderBottomColor: colors.slate[100] },
  sheetTitle: { fontSize: 14, lineHeight: 20, fontWeight: '700', color: colors.slate[900] },
  option: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 16, paddingVertical: 14 },
  optionText: { flex: 1, fontSize: 12, lineHeight: 16, fontWeight: '700', color: colors.slate[900] },
})
