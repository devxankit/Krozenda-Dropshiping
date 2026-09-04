import { useState } from 'react'
import { Textarea } from '../../../../components/ui'
import { ConfirmDialog } from '../overlay/ConfirmDialog'
import { OtpInput } from '../auth/OtpInput'
import { formatMoney } from '../../lib/format'

// The two ways a payout batch can end. Both are pulled out of the batch page
// so that screen stays the size of a screen.

/** Renders whichever decision the batch page has opened, or nothing. */
export function SettlementDecision({ deciding, onClose, batch, writer }) {
  if (deciding === 'release') {
    return <ReleasePayoutDialog isOpen onClose={onClose} batch={batch} approve={writer.approve} />
  }
  if (deciding === 'reject') {
    return <RejectPayoutDialog isOpen onClose={onClose} batch={batch} reject={writer.reject} />
  }
  return null
}

function ReleasePayoutDialog({ isOpen, onClose, batch, approve }) {
  const [code, setCode] = useState('')

  return (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={() => approve.run({ id: batch.id, twoFactorCode: code })}
      title="Release this payout"
      description={`${formatMoney(batch.net)} to ${batch.vendor} by ${batch.mode}. Enter the code from your authenticator to confirm.`}
      confirmLabel="Release payout"
      tone="danger"
      isSubmitting={approve.isSubmitting}
    >
      <div className="flex flex-col gap-2">
        <OtpInput value={code} onChange={setCode} disabled={approve.isSubmitting} />
        {approve.error && <p className="text-xs text-danger-700">{approve.error.message}</p>}
      </div>
    </ConfirmDialog>
  )
}

function RejectPayoutDialog({ isOpen, onClose, batch, reject }) {
  const [reason, setReason] = useState('')

  return (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={() => reject.run({ id: batch.id, reason })}
      title={`Reject batch ${batch.id}?`}
      description="Nothing is paid out. The batch returns to the hold queue and the vendor is told why."
      confirmLabel="Reject batch"
      tone="danger"
      isSubmitting={reject.isSubmitting}
    >
      <div className="flex flex-col gap-2">
        <Textarea
          id="reject-reason"
          label="Reason"
          rows={3}
          required
          placeholder="Bank details unverified, amount disputed, KYC lapsed…"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
        {reject.error && <p className="text-xs text-danger-700">{reject.error.message}</p>}
      </div>
    </ConfirmDialog>
  )
}
