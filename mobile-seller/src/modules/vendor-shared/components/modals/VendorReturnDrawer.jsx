import { useState } from 'react'
import { Linking, Pressable, StyleSheet, View } from 'react-native'
import { Image } from 'expo-image'
import { Badge, Button, Text, Textarea } from '../../../../components/ui'
import { Drawer } from '../../../../components/admin/overlay/Drawer'
import { InlineAlert } from '../../../../components/admin/feedback'
import { MoneyCell, StatusPill } from '../../../../components/admin/display'
import { toast } from '../../../../lib/toast'
import { VENDOR_RETURN_STATUS_TONE } from '../../constants'
import { colors } from '../../../../theme'

function Field({ label, children }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {typeof children === 'string' || typeof children === 'number' ? <Text style={styles.fieldValue}>{children}</Text> : children}
    </View>
  )
}

// What the seller is allowed to do here, and what they are not.
//
// They can record a recommendation with a note. They cannot approve, reject,
// refund or close the request — that is admin's, because approving a REFUND
// credits the buyer's wallet and a seller judging a claim against their own
// product is not a review. The copy says so plainly rather than leaving the
// seller to discover it when nothing happens.
// ReturnsPage keys this component by request id, so opening a different return
// REMOUNTS it and these initialisers run again. That is what keeps a note typed
// against one return from being submitted against another.
export function VendorReturnDrawer({ request, isOpen, onClose, controller }) {
  const [decision, setDecision] = useState(request?.sellerRecommendation?.decision ?? null)
  const [note, setNote] = useState(request?.sellerRecommendation?.note ?? '')

  if (!request) return null

  const isDecided = request.status !== 'PENDING'
  const existing = request.sellerRecommendation

  async function handleSubmit() {
    if (!decision) return
    try {
      await controller.recommend({ id: request.id, decision, note })
      toast.success('Recommendation sent', 'An admin makes the final decision.')
      onClose()
    } catch (err) {
      toast.error('Could not send', err?.response?.data?.message || 'Something went wrong')
    }
  }

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={request.productName}
      description={`${request.requestType} · raised by ${request.customer.name || 'a buyer'}`}
      width="lg"
      footer={
        <View style={styles.footer}>
          <Button variant="quiet" size="control" onClick={onClose}>
            Close
          </Button>
          {!isDecided ? (
            <Button size="control" onClick={handleSubmit} disabled={!decision} isLoading={controller.isRecommending}>
              {existing ? 'Update recommendation' : 'Send recommendation'}
            </Button>
          ) : null}
        </View>
      }
    >
      <View style={{ gap: 20 }}>
        <View style={styles.grid}>
          <Field label="Status">
            <StatusPill status={request.status} tones={VENDOR_RETURN_STATUS_TONE} size="sm" />
          </Field>
          <Field label="Refund value">{request.refundAmount ? <MoneyCell amount={request.refundAmount} compact /> : '—'}</Field>
          <Field label="Buyer">{request.customer.name || '—'}</Field>
          <Field label="Order">
            <Text noTranslate style={styles.fieldValue}>
              {request.orderId.slice(-8).toUpperCase()}
            </Text>
          </Field>
        </View>

        <View style={{ gap: 6 }}>
          <Text style={styles.fieldLabel}>Buyer’s reason</Text>
          <Text style={styles.reason}>{request.reason}</Text>
        </View>

        {request.photos.length > 0 ? (
          <View style={{ gap: 6 }}>
            <Text noTranslate style={styles.fieldLabel}>
              {`Evidence (${request.photos.length})`}
            </Text>
            <View style={styles.photos}>
              {request.photos.map((url) => (
                <Pressable key={url} onPress={() => Linking.openURL(url).catch(() => {})} accessibilityLabel="Buyer evidence">
                  <Image source={{ uri: url }} style={styles.photo} contentFit="cover" />
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {isDecided ? (
          <InlineAlert
            tone={request.status === 'REJECTED' ? 'danger' : request.status === 'ACCEPTED' ? 'info' : 'success'}
            title={
              request.status === 'ACCEPTED'
                ? 'Admin approved this return — the item is on its way back to you'
                : request.status === 'APPROVED'
                  ? `Return completed (${request.requestType === 'REFUND' ? 'buyer refunded' : 'replacement order created'})`
                  : 'Admin rejected this request'
            }
          >
            {request.adminNote || 'No note was left.'}
          </InlineAlert>
        ) : (
          <View style={styles.recBox}>
            <View>
              <Text style={styles.recTitle}>Your recommendation</Text>
              <Text style={styles.recHint}>Advisory — an admin reviews every return and makes the final call. Your note is what they read.</Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[
                { value: 'APPROVE', label: 'Recommend approve' },
                { value: 'REJECT', label: 'Recommend reject' },
              ].map((option) => {
                const on = decision === option.value
                const tone = option.value === 'APPROVE' ? colors.success : colors.danger
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => setDecision(option.value)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    style={[
                      styles.choice,
                      on
                        ? { borderColor: tone[500], backgroundColor: tone[50] }
                        : { borderColor: colors.border.DEFAULT, backgroundColor: colors.surface.DEFAULT },
                    ]}
                  >
                    <Text style={{ fontSize: 12, lineHeight: 16, fontWeight: '500', textAlign: 'center', color: on ? tone[700] : colors.ink.muted }}>
                      {option.label}
                    </Text>
                  </Pressable>
                )
              })}
            </View>

            <Textarea
              label="Why?"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. item came back with the seal broken, or this SKU is not ours"
              description="Admin sees this alongside the buyer's reason."
            />

            {existing ? (
              <Text style={styles.recHint}>
                {`You recommended ${existing.decision === 'APPROVE' ? 'approving' : 'rejecting'} this on ${new Date(existing.at).toLocaleDateString('en-IN')}. Sending again replaces it.`}
              </Text>
            ) : null}

            {controller.recommendError ? (
              <InlineAlert tone="danger" title="That did not go through">
                {controller.recommendError?.response?.data?.message || 'Try again in a moment.'}
              </InlineAlert>
            ) : null}
          </View>
        )}

        {existing && isDecided ? (
          <View style={{ gap: 4, alignItems: 'flex-start' }}>
            <Text style={styles.fieldLabel}>You recommended</Text>
            <Badge tone={existing.decision === 'APPROVE' ? 'success' : 'danger'} size="sm">
              {existing.decision === 'APPROVE' ? 'Approve' : 'Reject'}
            </Badge>
            {existing.note ? <Text style={{ marginTop: 4, fontSize: 12, lineHeight: 16, color: colors.ink.muted }}>{existing.note}</Text> : null}
          </View>
        ) : null}
      </View>
    </Drawer>
  )
}

const styles = StyleSheet.create({
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 16, columnGap: 16 },
  field: { width: '47%', flexGrow: 1, gap: 2, alignItems: 'flex-start' },
  fieldLabel: { fontSize: 11, lineHeight: 16, fontWeight: '600', letterSpacing: 0.55, textTransform: 'uppercase', color: colors.ink.faint },
  fieldValue: { fontSize: 12, lineHeight: 16, color: colors.slate[900] },
  reason: { borderRadius: 8, borderWidth: 1, borderColor: colors.border.DEFAULT, padding: 12, fontSize: 12, lineHeight: 16, color: colors.slate[900] },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photo: { width: 80, height: 80, borderRadius: 8, borderWidth: 1, borderColor: colors.border.DEFAULT },
  recBox: { gap: 12, borderRadius: 8, borderWidth: 1, borderColor: colors.border.DEFAULT, padding: 16 },
  recTitle: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.slate[900] },
  recHint: { marginTop: 2, fontSize: 11, lineHeight: 16, color: colors.ink.subtle },
  choice: { flex: 1, borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, justifyContent: 'center' },
})
