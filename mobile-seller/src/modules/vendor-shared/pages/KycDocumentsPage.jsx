import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Badge, Button, Skeleton, Text } from '../../../components/ui'
import { PageHeader } from '../../../components/admin/shell/PageHeader'
import { PageBody } from '../../../components/admin/shell/PageBody'
import { DataTable } from '../../../components/admin/data/DataTable'
import { toast } from '../../../lib/toast'
import {
  useVendorKycDocsController,
  useVendorOnboardingState,
  useVendorSubmitForVerificationController,
} from '../controllers/useVendorController'
import { VENDOR_KYC_DOC_COLUMNS } from '../tableColumns/miscColumns'
import { VENDOR_STATUS_LABELS, VENDOR_VERIFICATION_TONE } from '../constants'
import { UploadKycModal } from '../components/modals/UploadKycModal'
import { colors, shadows } from '../../../theme'

export function KycDocumentsPage() {
  const { data, isLoading } = useVendorKycDocsController()
  const { status, isLoading: isLoadingStatus } = useVendorOnboardingState()
  const { submit, isSubmitting } = useVendorSubmitForVerificationController()
  const [isUploadOpen, setIsUploadOpen] = useState(false)

  const kycList = data?.items || []
  const approvedCount = kycList.filter((d) => d.status === 'APPROVED').length
  const isFullyApproved = kycList.length > 0 && approvedCount === kycList.length

  // submitForVerification only accepts PENDING and REJECTED — see
  // vendorAuthController. Offering the button in UNDER_REVIEW or APPROVED
  // would just produce a 400 the seller cannot act on.
  const canSubmit = ['PENDING', 'REJECTED'].includes(status) && kycList.length > 0

  async function handleSubmitApplication() {
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
      <PageHeader
        title="KYC Verification & Compliance"
        description="Submit GSTIN, PAN, and Bank proof for automated bank payout enablement."
        actions={
          <>
            {canSubmit ? (
              <Button variant="primary" size="sm" onClick={handleSubmitApplication} disabled={isSubmitting}>
                {isSubmitting ? 'Submitting…' : status === 'REJECTED' ? 'Resubmit application' : 'Submit for review'}
              </Button>
            ) : null}
            <Button variant={canSubmit ? 'secondary' : 'primary'} size="sm" onClick={() => setIsUploadOpen(true)}>
              + Upload New Document
            </Button>
          </>
        }
      />

      {/* Compliance Overview Banner */}
      <View style={{ gap: 10, marginBottom: 12 }}>
        <View style={[styles.statCard, shadows['2xs']]}>
          <Text style={styles.statLabel}>KYC Verification Status</Text>
          <View style={{ marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Badge tone={isFullyApproved ? 'success' : 'warning'} size="sm">
              {isFullyApproved ? 'Fully Approved' : 'Review Pending'}
            </Badge>
          </View>
          <Text style={styles.statNote}>{isFullyApproved ? 'All submitted documents are verified' : 'Some documents are awaiting admin review'}</Text>
        </View>

        <View style={[styles.statCard, shadows['2xs']]}>
          <Text style={styles.statLabel}>Documents Submitted</Text>
          <Text style={styles.statValue}>
            {`${approvedCount} of ${kycList.length} Verified`}
          </Text>
          <Text style={styles.statNote}>PAN, GST & Bank proof recommended</Text>
        </View>

        {/* The vendor's real verificationStatus, not the document tally above.
            These two genuinely differ: every document can be APPROVED while
            the account itself is still UNDER_REVIEW, because an admin approves
            the account separately (adminVendorController.updateVendorStatus). */}
        <View style={[styles.statCard, shadows['2xs']]}>
          <Text style={styles.statLabel}>Account Status</Text>
          <View style={{ marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {isLoadingStatus || !status ? (
              <Skeleton style={{ height: 24, width: 128, borderRadius: 9999 }} />
            ) : (
              <Badge tone={VENDOR_VERIFICATION_TONE[status] || 'neutral'} size="sm">
                {VENDOR_STATUS_LABELS[status.toLowerCase()] || status}
              </Badge>
            )}
          </View>
          <Text style={styles.statNote}>
            {status === 'PENDING'
              ? 'Upload your documents, then submit for review'
              : status === 'UNDER_REVIEW'
                ? 'An admin is reviewing your application'
                : status === 'REJECTED'
                  ? 'Fix the flagged documents and submit again'
                  : 'Admin reviews each document individually'}
          </Text>
        </View>
      </View>

      {isLoading ? (
        <Skeleton style={{ height: 256, width: '100%', borderRadius: 12 }} />
      ) : (
        <View style={[styles.repo, shadows['2xs']]}>
          <View style={styles.repoHead}>
            <Text style={styles.repoTitle}>Uploaded KYC Document Repository</Text>
          </View>
          <DataTable columns={VENDOR_KYC_DOC_COLUMNS} data={kycList} />
        </View>
      )}

      <UploadKycModal isOpen={isUploadOpen} onClose={() => setIsUploadOpen(false)} />
    </PageBody>
  )
}

const styles = StyleSheet.create({
  statCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.8)',
    backgroundColor: colors.surface.DEFAULT,
    padding: 14,
  },
  statLabel: { fontSize: 10, lineHeight: 15, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase', color: colors.ink.subtle },
  statValue: { marginTop: 4, fontSize: 16, lineHeight: 24, fontWeight: '700', letterSpacing: -0.4, color: colors.slate[900] },
  statNote: { marginTop: 4, fontSize: 10, lineHeight: 15, color: colors.ink.subtle },
  repo: {
    overflow: 'hidden',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.8)',
    backgroundColor: colors.surface.DEFAULT,
  },
  repoHead: { borderBottomWidth: 1, borderBottomColor: colors.border.DEFAULT, paddingHorizontal: 14, paddingVertical: 10 },
  repoTitle: { fontSize: 11, lineHeight: 16, fontWeight: '600', letterSpacing: 0.55, textTransform: 'uppercase', color: colors.slate[700] },
})
