import { useState } from 'react'
import { Badge, Button, Modal, Textarea } from '../../../components/ui'
import { PageBody, PageHeader } from '../../admin/components/shell'
import { toast } from '../../admin/stores/toastStore'
import { useVendorReviewsController } from '../controllers/useVendorController'

function Stars({ rating }) {
  return (
    <span className="text-warning-500 text-xs">
      {'★'.repeat(Math.round(rating))}
      <span className="text-slate-300">{'★'.repeat(5 - Math.round(rating))}</span>
    </span>
  )
}

export function ReviewsPage() {
  const { items, isLoading, reply } = useVendorReviewsController()
  const [activeReview, setActiveReview] = useState(null)
  const [message, setMessage] = useState('')

  async function handleReply() {
    if (!message.trim()) return
    try {
      await reply(activeReview.id, message.trim())
      toast.success('Reply posted', 'Your reply is now visible on the review.')
      setActiveReview(null)
      setMessage('')
    } catch (err) {
      toast.error('Could not reply', err?.response?.data?.message || 'Something went wrong')
    }
  }

  return (
    <PageBody>
      <PageHeader title="Reviews & Ratings" description="Customer reviews on your products. Reply publicly to any review." />

      {isLoading && <p className="text-xs text-ink-subtle">Loading reviews…</p>}
      {!isLoading && items.length === 0 && <p className="text-xs text-ink-subtle">No reviews on your products yet.</p>}

      <div className="flex flex-col gap-3">
        {items.map((review) => (
          <div key={review.id} className="rounded-lg border border-border bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                {review.productImage && <img src={review.productImage} alt="" className="h-9 w-9 rounded-md object-cover" />}
                <div>
                  <p className="text-xs font-semibold text-slate-900">{review.productName}</p>
                  <p className="text-2xs text-ink-subtle">{review.author}</p>
                </div>
              </div>
              <Stars rating={review.rating} />
            </div>
            {review.reviewText && <p className="mt-2.5 text-xs text-ink-muted">{review.reviewText}</p>}

            {review.vendorReply ? (
              <div className="mt-3 rounded-md bg-surface-muted p-2.5">
                <Badge tone="brand" size="xs">Your reply</Badge>
                <p className="mt-1 text-xs text-ink-muted">{review.vendorReply.message}</p>
              </div>
            ) : (
              <Button className="mt-3" size="xs" variant="secondary" onClick={() => setActiveReview(review)}>
                Reply
              </Button>
            )}
          </div>
        ))}
      </div>

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
            <Button onClick={handleReply}>Post reply</Button>
          </>
        }
      >
        <Textarea label="Your reply" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Thank the customer or address their feedback…" />
      </Modal>
    </PageBody>
  )
}
