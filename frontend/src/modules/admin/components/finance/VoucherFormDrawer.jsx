import { useState } from 'react'
import { Input, Switch, Textarea } from '../../../../components/ui'
import { FormDrawer } from '../forms'
import { journalVoucherWriteSchema } from '../../schemas/financeSchema'
import { blankVoucherLines } from '../../lib/money'
import { VoucherLines } from './VoucherLines'

const isoToday = () => new Date().toISOString().slice(0, 10)

// Keyed on the voucher being edited by the caller, so opening a different row
// remounts this with fresh state rather than needing an effect to resync.
export function VoucherFormDrawer({ isOpen, onClose, voucher, accounts, writer }) {
  const editing = Boolean(voucher)
  const [date, setDate] = useState(isoToday)
  const [narration, setNarration] = useState(voucher?.narration ?? '')
  const [lines, setLines] = useState(() => voucher?.lines?.map((line) => ({ ...line })) || blankVoucherLines())
  const [postNow, setPostNow] = useState(voucher ? voucher.status === 'posted' : true)
  const [issue, setIssue] = useState(null)

  const mutation = editing ? writer.update : writer.create

  function handleSubmit(event) {
    event.preventDefault()

    const payload = {
      date,
      narration,
      status: postNow ? 'posted' : 'draft',
      lines: lines.filter((line) => line.code && (line.debit > 0 || line.credit > 0)),
    }

    const result = journalVoucherWriteSchema.safeParse(payload)
    if (!result.success) {
      setIssue(result.error.issues[0].message)
      return
    }

    setIssue(null)
    mutation.run(editing ? { id: voucher.id, ...payload } : payload)
  }

  return (
    <FormDrawer
      isOpen={isOpen}
      onClose={onClose}
      width="lg"
      title={editing ? `Edit ${voucher.number}` : 'New journal voucher'}
      description="Manual double entry. Debits must equal credits before this can be saved."
      submitLabel={postNow ? 'Post to ledger' : 'Save draft'}
      isSubmitting={mutation.isSubmitting}
      error={issue ? { message: issue } : mutation.error}
      onSubmit={handleSubmit}
    >
      <div className="grid grid-cols-2 gap-3">
        <Input
          id="voucher-date"
          type="date"
          label="Posting date"
          required
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />
        <div className="flex items-end pb-1">
          <Switch
            id="voucher-post-now"
            label="Post immediately"
            description="Off saves it as a draft"
            checked={postNow}
            onChange={(event) => setPostNow(event.target.checked)}
          />
        </div>
      </div>

      <Textarea
        id="voucher-narration"
        label="Narration"
        rows={2}
        required
        placeholder="What is this posting for?"
        value={narration}
        onChange={(event) => setNarration(event.target.value)}
      />

      <VoucherLines
        lines={lines}
        onChange={setLines}
        accounts={accounts}
        disabled={mutation.isSubmitting}
      />
    </FormDrawer>
  )
}
