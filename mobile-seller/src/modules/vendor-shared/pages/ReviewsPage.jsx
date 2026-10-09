import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Image } from 'expo-image'
import { Badge, Button, Modal, Text, Textarea } from '../../../components/ui'
import { PageBody, PageHeader } from '../../../components/admin/shell'
import { toast } from '../../../lib/toast'
import { useVendorReviewsController } from '../controllers/useVendorController'
import { colors } from '../../../theme'

function Stars({ rating }) {
  const filled = Math.round(rating)
  return (
    <Text noTranslate style={{ fontSize: 12, lineHeight: 16, color: colors.warning[500] }}>
      {'★'.repeat(filled)}
      <Text noTranslate style={{ fontSize: 12, lineHeight: 16, color: colors.slate[300] }}>
        {'★'.repeat(5 - filled)}
      </Text>
    </Text>
  )
}

export function ReviewsPage() {
  const { items, isLoading, reply } = useVendorReviewsController()
  const [activeReview, setActiveReview] = useState(null)
  const [message, setMessage] = useState('')
  const [isPosting, setIsPosting] = useState(false)

  async function handleReply() {
    if (!message.trim() || isPosting) return
    setIsPosting(true)
    try {
      await reply(activeReview.id, message.trim())
      toast.success('Reply posted', 'Your reply is now visible on the review.')
      setActiveReview(null)
      setMessage('')
    } catch (err) {
      toast.error('Could not reply', err?.response?.data?.message || 'Something went wrong')
    } finally {
      setIsPosting(false)
    }
  }

  return (
    <PageBody>
      <PageHeader title="Reviews & Ratings" description="Customer reviews on your products. Reply publicly to any review." />

      {isLoading ? <Text style={styles.note}>Loading reviews…</Text> : null}
      {!isLoading && items.length === 0 ? <Text style={styles.note}>No reviews on your products yet.</Text> : null}

      <View style={{ gap: 12 }}>
        {items.map((review) => (
          <View key={review.id} style={styles.card}>
            <View style={styles.top}>
              <View style={styles.who}>
                {review.productImage ? <Image source={{ uri: review.productImage }} style={styles.thumb} contentFit="cover" /> : null}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.product}>{review.productName}</Text>
                  <Text style={styles.author}>{review.author}</Text>
                </View>
              </View>
              <Stars rating={review.rating} />
            </View>
            {review.reviewText ? <Text style={styles.body}>{review.reviewText}</Text> : null}

            {review.vendorReply ? (
              <View style={styles.reply}>
                <Badge tone="brand" size="sm">
                  Your reply
                </Badge>
                <Text style={[styles.body, { marginTop: 4 }]}>{review.vendorReply.message}</Text>
              </View>
            ) : (
              <View style={{ marginTop: 12, alignSelf: 'flex-start' }}>
                <Button size="xs" variant="secondary" onClick={() => setActiveReview(review)}>
                  Reply
                </Button>
              </View>
            )}
          </View>
        ))}
      </View>

      <Modal
        isOpen={Boolean(activeReview)}
        onClose={() => setActiveReview(null)}
        title="Reply to review"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setActiveReview(null)}>
              Cancel
            </Button>
            <Button onClick={handleReply} isLoading={isPosting}>
              Post reply
            </Button>
          </>
        }
      >
        <Textarea label="Your reply" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Thank the customer or address their feedback…" />
      </Modal>
    </PageBody>
  )
}

const styles = StyleSheet.create({
  note: { fontSize: 12, lineHeight: 16, color: colors.ink.subtle },
  card: { borderRadius: 8, borderWidth: 1, borderColor: colors.border.DEFAULT, backgroundColor: colors.surface.DEFAULT, padding: 16 },
  top: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  who: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  thumb: { width: 36, height: 36, borderRadius: 6 },
  product: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.slate[900] },
  author: { fontSize: 11, lineHeight: 16, color: colors.ink.subtle },
  body: { marginTop: 10, fontSize: 12, lineHeight: 16, color: colors.ink.muted },
  reply: { marginTop: 12, borderRadius: 6, backgroundColor: colors.surface.muted, padding: 10, alignItems: 'flex-start' },
})
