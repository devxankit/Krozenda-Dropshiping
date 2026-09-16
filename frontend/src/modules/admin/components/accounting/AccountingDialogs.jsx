import { useState } from 'react'
import { Button, Input, Modal, Select, Textarea } from '../../../../components/ui'
import { InlineAlert } from '../feedback'
import { formatMoney } from '../display'
import { MoneyBreakdown } from './AccountingShell'

// The confirmations in front of every action that moves money.
//
// House rule for this module: a dialog that releases money SHOWS the amount
// and who it is going to, and never enables its confirm button until whatever
// the action needs (a reason, a UTR) is actually filled in. An operator
// should not be able to pay the wrong seller by reflex.

// ---------------------------------------------------------------------------
// Manual adjustment (task §19)
// ---------------------------------------------------------------------------

const DIRECTIONS = [
  { value: 'CREDIT', label: 'Credit — we owe the seller more' },
  { value: 'DEBIT', label: 'Debit — we owe the seller less' },
]

export function AdjustmentDialog({ isOpen, onClose, seller, sellerId, onSubmit, isSubmitting }) {
  const [amount, setAmount] = useState('')
  const [direction, setDirection] = useState('CREDIT')
  const [reason, setReason] = useState('')

  if (!isOpen) return null

  const rupees = Number(String(amount).replace(/[^0-9.]/g, ''))
  const isValid = Number.isFinite(rupees) && rupees > 0 && reason.trim().length > 0

  function submit() {
    if (!isValid) return
    onSubmit({ sellerId, amount: rupees, direction, reason: reason.trim() })
    setAmount('')
    setReason('')
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Record a manual adjustment"
      description={`A ledger entry against ${seller}. There is no other way to move a seller's balance.`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" size="control" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button size="control" onClick={submit} disabled={!isValid || isSubmitting} isLoading={isSubmitting}>
            Post adjustment
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Select
          id="adjustment-direction"
          label="Type"
          required
          value={direction}
          onChange={(event) => setDirection(event.target.value)}
          options={DIRECTIONS}
        />
        <Input
          id="adjustment-amount"
          label="Amount"
          required
          inputMode="decimal"
          placeholder="500"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          description={
            Number.isFinite(rupees) && rupees > 0
              ? `${direction === 'CREDIT' ? 'Credit' : 'Debit'} of ${formatMoney(Math.round(rupees * 100))}`
              : 'In rupees'
          }
        />
        <Textarea
          id="adjustment-reason"
          label="Reason"
          required
          rows={3}
          placeholder="Shipping compensation for a delayed dispatch"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          description="Stored on the transaction and in the audit log."
        />
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Payout
// ---------------------------------------------------------------------------

const METHODS = [
  { value: 'BANK_TRANSFER', label: 'Bank transfer' },
  { value: 'UPI', label: 'UPI' },
  { value: 'MANUAL', label: 'Manual / offline' },
]

export function CreatePayoutDialog({ isOpen, onClose, settlement, onSubmit, isSubmitting }) {
  const [method, setMethod] = useState('BANK_TRANSFER')
  const [notes, setNotes] = useState('')

  if (!isOpen || !settlement) return null

  const account = settlement.fundAccount

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Pay this settlement"
      description={`${settlement.seller} · ${settlement.settlementId}`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" size="control" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            size="control"
            onClick={() => onSubmit({ settlementId: settlement.id, method, notes: notes.trim() })}
            disabled={isSubmitting || (account && !account.onFile)}
            isLoading={isSubmitting}
          >
            Initiate payout
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <MoneyBreakdown
          className="rounded-md border border-border bg-surface-muted/40 px-3 py-2"
          lines={[
            { label: 'Gross sales', value: settlement.grossSales, sign: '+' },
            { label: 'Commission', value: settlement.commission, sign: '-' },
            { label: 'Fees', value: settlement.fees, sign: '-' },
            { label: 'Refunds', value: settlement.refunds, sign: '-' },
            { label: 'Adjustments', value: settlement.adjustments, sign: settlement.adjustments < 0 ? '-' : '+' },
          ]}
          total={settlement.netPayable}
          totalLabel="Amount to transfer"
        />

        {account && !account.onFile ? (
          <InlineAlert tone="warning" title="No bank account on file">
            Collect this seller&rsquo;s payout details before paying them.
          </InlineAlert>
        ) : (
          account && (
            <div className="rounded-md border border-border px-3 py-2 text-xs">
              <p className="font-medium text-slate-900">{account.accountHolderName || settlement.seller}</p>
              <p className="tabular mt-0.5 text-ink-subtle">
                {account.bankName} · {account.accountMasked} · {account.ifsc}
              </p>
            </div>
          )
        )}

        <Select
          id="payout-method"
          label="Method"
          value={method}
          onChange={(event) => setMethod(event.target.value)}
          options={METHODS}
        />
        <Textarea
          id="payout-notes"
          label="Notes"
          rows={2}
          placeholder="Optional"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />

        <p className="text-2xs leading-relaxed text-ink-faint">
          Pressing this twice is safe — a settlement can only ever have one live payout.
        </p>
      </div>
    </Modal>
  )
}

export function CompletePayoutDialog({ isOpen, onClose, payout, onSubmit, isSubmitting }) {
  const [utr, setUtr] = useState('')
  const [providerReference, setProviderReference] = useState('')

  if (!isOpen || !payout) return null

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Mark this payout completed"
      description={`${formatMoney(payout.amount)} to ${payout.seller}`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" size="control" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            size="control"
            onClick={() => onSubmit({ id: payout.id, status: 'COMPLETED', utr: utr.trim(), providerReference: providerReference.trim() })}
            disabled={!utr.trim() || isSubmitting}
            isLoading={isSubmitting}
          >
            Confirm transfer
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <InlineAlert tone="warning" title="This is the point of no return">
          Completing a payout debits the seller&rsquo;s ledger and cannot be undone — a mistake after
          this has to be corrected with an adjustment.
        </InlineAlert>
        <Input
          id="payout-utr"
          label="UTR / bank reference"
          required
          placeholder="UTR123456789"
          value={utr}
          onChange={(event) => setUtr(event.target.value)}
        />
        <Input
          id="payout-provider-ref"
          label="Provider reference"
          placeholder="Optional"
          value={providerReference}
          onChange={(event) => setProviderReference(event.target.value)}
        />
      </div>
    </Modal>
  )
}

export function FailPayoutDialog({ isOpen, onClose, payout, onSubmit, isSubmitting }) {
  const [failureReason, setFailureReason] = useState('')

  if (!isOpen || !payout) return null

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Mark this payout failed"
      description={`${payout.payoutId} · ${formatMoney(payout.amount)}`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" size="control" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="danger"
            size="control"
            onClick={() => onSubmit({ id: payout.id, status: 'FAILED', failureReason: failureReason.trim() })}
            disabled={!failureReason.trim() || isSubmitting}
            isLoading={isSubmitting}
          >
            Mark failed
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-xs leading-relaxed text-ink-subtle">
          Nothing is posted to the ledger for a failed payout, and the settlement becomes payable
          again so it can be retried. This attempt stays on the record.
        </p>
        <Textarea
          id="payout-failure-reason"
          label="What went wrong"
          required
          rows={3}
          placeholder="Bank rejected the IFSC"
          value={failureReason}
          onChange={(event) => setFailureReason(event.target.value)}
        />
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Settlement hold
// ---------------------------------------------------------------------------

export function HoldSettlementDialog({ isOpen, onClose, settlement, onSubmit, isSubmitting }) {
  const [reason, setReason] = useState('')

  if (!isOpen || !settlement) return null

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Put this settlement on hold"
      description={`${settlement.settlementId} · ${settlement.seller}`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" size="control" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="danger"
            size="control"
            onClick={() => onSubmit({ id: settlement.id, reason: reason.trim() })}
            disabled={!reason.trim() || isSubmitting}
            isLoading={isSubmitting}
          >
            Hold settlement
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-xs leading-relaxed text-ink-subtle">
          {formatMoney(settlement.netPayable)} stays with the platform and cannot be paid out until
          this is released. The lines stay locked to this batch, so nothing else can pick them up.
        </p>
        <Textarea
          id="hold-reason"
          label="Reason"
          required
          rows={3}
          placeholder="KYC documents under review"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// COD remittance (task §12)
// ---------------------------------------------------------------------------

export function CodRemittanceDialog({ isOpen, onClose, order, onSubmit, isSubmitting }) {
  const [reference, setReference] = useState('')

  if (!isOpen || !order) return null

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Record COD collection"
      description={`${order.orderNumber} · ${formatMoney(order.amount)}`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" size="control" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            size="control"
            onClick={() => onSubmit({ orderId: order.orderId, reference: reference.trim() })}
            disabled={isSubmitting}
            isLoading={isSubmitting}
          >
            Confirm collection
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-xs leading-relaxed text-ink-subtle">
          Confirm only once the courier has actually remitted this cash. This is the moment the sale
          reaches the ledger and the seller&rsquo;s share starts counting towards a settlement.
        </p>
        <Input
          id="cod-reference"
          label="Courier / remittance reference"
          placeholder="Optional"
          value={reference}
          onChange={(event) => setReference(event.target.value)}
        />
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Refund decision
// ---------------------------------------------------------------------------

export function RefundDecisionDialog({ isOpen, onClose, refund, decision, onSubmit, isSubmitting }) {
  const [reason, setReason] = useState('')

  if (!isOpen || !refund) return null

  const approving = decision === 'approve'

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={approving ? 'Approve this refund?' : 'Decline this refund?'}
      description={`${refund.refundId} · ${formatMoney(refund.amount)} · ${refund.customer}`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" size="control" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant={approving ? 'primary' : 'danger'}
            size="control"
            onClick={() => onSubmit({ id: refund.id, reason: reason.trim() })}
            disabled={(!approving && !reason.trim()) || isSubmitting}
            isLoading={isSubmitting}
          >
            {approving ? 'Approve refund' : 'Decline refund'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-xs leading-relaxed text-ink-subtle">
          {approving ? (
            <>
              {formatMoney(refund.amount)} is credited to the buyer&rsquo;s wallet, and the same amount
              is reversed off {refund.seller}&rsquo;s ledger along with the commission charged on it.
              The original sale entry is kept.
            </>
          ) : (
            'The buyer is told why. Nothing is paid back and the seller’s sale stands.'
          )}
        </p>
        <Textarea
          id="refund-reason"
          label={approving ? 'Note' : 'Reason the buyer will see'}
          required={!approving}
          rows={3}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </div>
    </Modal>
  )
}
