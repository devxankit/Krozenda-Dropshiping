import { StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Badge, Button, Icon, Skeleton, Text } from '../../../components/ui'
import { PageBody, PageHeader } from '../../../components/admin/shell'
import { SectionCard } from '../../../components/admin/display'
import { toast } from '../../../lib/toast'
import { SELLER_ROUTES } from '../../../config/routes'
import {
  useVendorKycDocsController,
  useVendorProfileController,
  useVendorSubmitForVerificationController,
} from '../controllers/useVendorController'
import { VENDOR_STATUS_LABELS, VENDOR_VERIFICATION_TONE } from '../constants'
import { colors, shadows } from '../../../theme'

const COPY = {
  PENDING: {
    headline: 'Finish your application',
    body: 'Upload your KYC documents, then submit your application. An admin reviews it and unlocks selling.',
  },
  UNDER_REVIEW: {
    headline: 'Your application is with our team',
    body: 'We are verifying your documents. You will be notified as soon as a decision is made — no action needed from you right now.',
  },
  REJECTED: {
    headline: 'Your application needs changes',
    body: 'Fix the points below, replace any document that was rejected, and submit again.',
  },
  APPROVED: {
    headline: 'You are verified',
    body: 'Your account is approved and every part of the panel is open.',
  },
}

function Step({ done, current, title, description, action, first }) {
  const bubble = done
    ? { backgroundColor: colors.success[100] }
    : current
      ? { backgroundColor: colors.brand[100] }
      : { backgroundColor: colors.surface.muted }
  return (
    <View style={[styles.step, !first && styles.stepDivider]}>
      <View style={[styles.bubble, bubble]}>{done ? <Icon name="check" size={12} color={colors.success[700]} /> : null}</View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 12, lineHeight: 16, fontWeight: '600', color: done || current ? colors.slate[900] : colors.ink.subtle }}>{title}</Text>
        <Text style={styles.stepDesc}>{description}</Text>
      </View>
      {action}
    </View>
  )
}

export function VendorOnboardingStatusPage() {
  const router = useRouter()
  const { data: vendor, isLoading } = useVendorProfileController()
  const { data: docs, isLoading: isLoadingDocs } = useVendorKycDocsController()
  const { submit, isSubmitting } = useVendorSubmitForVerificationController()

  if (isLoading || !vendor) {
    return (
      <PageBody>
        <PageHeader title="Verification status" description="Where your seller application stands." />
        <Skeleton style={{ height: 256, width: '100%', borderRadius: 12 }} />
      </PageBody>
    )
  }

  const status = vendor.verificationStatus
  const copy = COPY[status] || COPY.PENDING
  const documents = docs?.items || []
  const rejectedDocs = documents.filter((d) => d.status === 'REJECTED')
  const hasDocuments = documents.length > 0
  const canSubmit = ['PENDING', 'REJECTED'].includes(status) && hasDocuments

  async function handleSubmit() {
    if (isSubmitting) return
    try {
      await submit()
      toast.success('Application submitted', 'An admin will review your documents shortly.')
    } catch (err) {
      toast.error('Could not submit', err?.response?.data?.message || 'Something went wrong')
    }
  }

  return (
    <PageBody>
      <PageHeader title="Verification status" description="Where your seller application stands." />

      <View style={[styles.statusCard, shadows['2xs']]}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
          <Badge tone={VENDOR_VERIFICATION_TONE[status] || 'neutral'} size="md">
            {VENDOR_STATUS_LABELS[status.toLowerCase()] || status}
          </Badge>
          <Text style={{ fontSize: 14, lineHeight: 20, fontWeight: '600', color: colors.slate[900] }}>{copy.headline}</Text>
        </View>
        <Text style={styles.statusBody}>{copy.body}</Text>

        {status === 'REJECTED' && vendor.rejectionReason ? (
          <Text style={styles.reason}>
            <Text style={[styles.reasonText, { fontWeight: '600' }]}>Reason: </Text>
            {vendor.rejectionReason}
          </Text>
        ) : null}
      </View>

      <SectionCard title="What happens next" description="Three steps from sign-up to selling">
        <View>
          <Step first done title="Account created" description={`Signed up as ${vendor.email}`} />
          <Step
            done={hasDocuments && rejectedDocs.length === 0}
            current={!hasDocuments || rejectedDocs.length > 0}
            title="Upload KYC documents"
            description={
              isLoadingDocs
                ? 'Loading your documents…'
                : hasDocuments
                  ? `${documents.length} uploaded${rejectedDocs.length > 0 ? ` · ${rejectedDocs.length} rejected and need replacing` : ''}`
                  : 'PAN, GST certificate and a bank proof are the usual set.'
            }
            action={
              <Button size="xs" variant="secondary" onClick={() => router.push(SELLER_ROUTES.KYC_DOCUMENTS)}>
                Manage
              </Button>
            }
          />
          <Step
            done={status === 'APPROVED'}
            current={status === 'UNDER_REVIEW'}
            title="Admin review"
            description={
              status === 'UNDER_REVIEW'
                ? 'In progress — we will notify you when there is a decision.'
                : 'Submit your application once your documents are in.'
            }
            action={
              canSubmit ? (
                <Button size="xs" onClick={handleSubmit} disabled={isSubmitting}>
                  {isSubmitting ? 'Submitting…' : status === 'REJECTED' ? 'Resubmit' : 'Submit'}
                </Button>
              ) : null
            }
          />
        </View>
      </SectionCard>

      {!hasDocuments && ['PENDING', 'REJECTED'].includes(status) ? (
        <Text style={{ marginTop: 16, fontSize: 11, lineHeight: 16, color: colors.ink.subtle }}>
          Upload at least one document before submitting — an empty application cannot be reviewed.
        </Text>
      ) : null}
    </PageBody>
  )
}

const styles = StyleSheet.create({
  statusCard: {
    marginBottom: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.DEFAULT,
    backgroundColor: colors.surface.DEFAULT,
    padding: 20,
  },
  statusBody: { marginTop: 8, fontSize: 12, lineHeight: 16, color: colors.ink.subtle },
  reason: {
    marginTop: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.danger[200],
    backgroundColor: colors.danger[50],
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12,
    lineHeight: 16,
    color: colors.danger[700],
  },
  reasonText: { fontSize: 12, lineHeight: 16, color: colors.danger[700] },
  step: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  stepDivider: { borderTopWidth: 1, borderTopColor: colors.border.DEFAULT },
  bubble: { marginTop: 2, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  stepDesc: { marginTop: 2, fontSize: 11, lineHeight: 16, color: colors.ink.subtle },
})
