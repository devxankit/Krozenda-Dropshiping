import { useState } from 'react'
import { Input, Select, Switch, Textarea } from '../../../../components/ui'
import { FormDrawer } from '../forms'
import { expenseWriteSchema } from '../../schemas/financeSchema'
import { formatRupees, toPaise, toRupeeInput } from '../../lib/money'

const isoToday = () => new Date().toISOString().slice(0, 10)

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft — not in the books yet' },
  { value: 'posted', label: 'Posted — accrued, not yet paid' },
  { value: 'paid', label: 'Paid' },
]

export function ExpenseFormDrawer({ isOpen, onClose, expense, categories = [], writer }) {
  const editing = Boolean(expense)
  const [form, setForm] = useState(() => ({
    date: isoToday(),
    category: expense?.category ?? categories[0] ?? '',
    vendor: expense?.vendor ?? '',
    narration: expense?.narration ?? '',
    amount: expense?.amount ?? 0,
    gst: expense?.gst ?? 0,
    itcClaimable: expense?.itcClaimable ?? true,
    status: expense?.status ?? 'posted',
  }))
  const [issue, setIssue] = useState(null)

  const mutation = editing ? writer.update : writer.create
  const set = (patch) => setForm((current) => ({ ...current, ...patch }))

  function handleSubmit(event) {
    event.preventDefault()
    const result = expenseWriteSchema.safeParse(form)
    if (!result.success) {
      setIssue(result.error.issues[0].message)
      return
    }
    setIssue(null)
    mutation.run(editing ? { id: expense.id, ...form } : form)
  }

  return (
    <FormDrawer
      isOpen={isOpen}
      onClose={onClose}
      title={editing ? 'Edit expense' : 'Record an expense'}
      description="Posts to the category account, with claimable GST going to input tax credit."
      submitLabel={editing ? 'Save changes' : 'Record expense'}
      isSubmitting={mutation.isSubmitting}
      error={issue ? { message: issue } : mutation.error}
      onSubmit={handleSubmit}
    >
      <div className="grid grid-cols-2 gap-3">
        <Input
          id="expense-date"
          type="date"
          label="Date"
          required
          value={form.date}
          onChange={(event) => set({ date: event.target.value })}
        />
        <Select
          id="expense-status"
          label="Status"
          options={STATUS_OPTIONS}
          value={form.status}
          onChange={(event) => set({ status: event.target.value })}
        />
      </div>

      <Select
        id="expense-category"
        label="Category"
        required
        placeholder="Pick a category"
        options={categories.map((name) => ({ value: name, label: name }))}
        value={form.category}
        description="Categories are the operating expense accounts in the chart of accounts."
        onChange={(event) => set({ category: event.target.value })}
      />

      <Input
        id="expense-vendor"
        label="Paid to"
        required
        placeholder="Supplier or payee"
        value={form.vendor}
        onChange={(event) => set({ vendor: event.target.value })}
      />

      <Textarea
        id="expense-narration"
        label="Narration"
        rows={2}
        required
        value={form.narration}
        onChange={(event) => set({ narration: event.target.value })}
      />

      <div className="grid grid-cols-2 gap-3">
        <Input
          id="expense-amount"
          label="Amount (excl. GST)"
          required
          inputMode="decimal"
          className="tabular text-right"
          value={toRupeeInput(form.amount)}
          onChange={(event) => set({ amount: toPaise(event.target.value) })}
        />
        <Input
          id="expense-gst"
          label="GST"
          inputMode="decimal"
          className="tabular text-right"
          value={toRupeeInput(form.gst)}
          onChange={(event) => set({ gst: toPaise(event.target.value) })}
        />
      </div>

      <Switch
        id="expense-itc"
        label="Input tax credit claimable"
        description={
          form.itcClaimable
            ? `${formatRupees(form.gst)} goes to input credit receivable, not to expense`
            : `${formatRupees(form.gst)} is absorbed into the expense`
        }
        checked={form.itcClaimable}
        onChange={(event) => set({ itcClaimable: event.target.checked })}
      />
    </FormDrawer>
  )
}
