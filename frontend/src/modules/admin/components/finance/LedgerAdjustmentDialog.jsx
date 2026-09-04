import { useState } from 'react'
import { Input, Textarea } from '../../../../components/ui'
import { ConfirmDialog } from '../overlay/ConfirmDialog'
import { formatMoney } from '../../lib/format'
import { formatRupees, toPaise } from '../../lib/money'

// A manual movement against one vendor's running balance. Both sides post, so
// the sum of every vendor closing balance still equals account 2010 after it.
export function LedgerAdjustmentDialog({ isOpen, onClose, ledger, adjust }) {
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')

  const paise = toPaise(amount)
  const projected = ledger.closing + paise

  return (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={() => adjust.run({ vendorId: ledger.id, amount: paise, reason })}
      title={`Adjust ${ledger.vendor}`}
      description={`Closing balance today is ${formatMoney(ledger.closing)}. A positive amount credits the vendor, a negative one recovers from them.`}
      confirmLabel="Post adjustment"
      tone="primary"
      isSubmitting={adjust.isSubmitting}
    >
      <div className="flex flex-col gap-3">
        <Input
          id="adjust-amount"
          label="Amount"
          required
          inputMode="decimal"
          placeholder="-1250.00"
          className="tabular text-right"
          value={amount}
          description={paise ? `Closing becomes ${formatRupees(projected)}` : 'Use a minus sign to recover money'}
          onChange={(event) => setAmount(event.target.value)}
        />
        <Textarea
          id="adjust-reason"
          label="Reason"
          rows={2}
          required
          placeholder="Penalty for late dispatch, recovery of RTO cost, correction…"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
        {adjust.error && <p className="text-xs text-danger-700">{adjust.error.message}</p>}
      </div>
    </ConfirmDialog>
  )
}
