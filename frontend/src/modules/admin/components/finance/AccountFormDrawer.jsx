import { useState } from 'react'
import { Input, Select, Switch } from '../../../../components/ui'
import { FormDrawer } from '../forms'
import { InlineAlert } from '../feedback'
import { accountWriteSchema } from '../../schemas/financeSchema'

const GROUP_OPTIONS = [
  { value: 'asset', label: 'Asset — debit balance' },
  { value: 'liability', label: 'Liability — credit balance' },
  { value: 'equity', label: 'Equity — credit balance' },
  { value: 'income', label: 'Income — credit balance' },
  { value: 'expense', label: 'Expense — debit balance' },
]

export function AccountFormDrawer({ isOpen, onClose, account, writer }) {
  const editing = Boolean(account)
  const [form, setForm] = useState(() => ({
    code: account?.code ?? '',
    name: account?.name ?? '',
    group: account?.group ?? 'expense',
    isSubLedger: account?.isSubLedger ?? false,
  }))
  const [issue, setIssue] = useState(null)

  const mutation = editing ? writer.update : writer.create
  const set = (patch) => setForm((current) => ({ ...current, ...patch }))
  const groupLocked = editing && account.balance !== 0

  function handleSubmit(event) {
    event.preventDefault()
    const result = accountWriteSchema.safeParse(form)
    if (!result.success) {
      setIssue(result.error.issues[0].message)
      return
    }
    setIssue(null)
    mutation.run(editing ? { ...form, code: account.code } : form)
  }

  return (
    <FormDrawer
      isOpen={isOpen}
      onClose={onClose}
      title={editing ? `Edit account ${account.code}` : 'New account'}
      description="An account is where a posting can land. New accounts open with a nil balance."
      submitLabel={editing ? 'Save changes' : 'Create account'}
      isSubmitting={mutation.isSubmitting}
      error={issue ? { message: issue } : mutation.error}
      onSubmit={handleSubmit}
    >
      <div className="grid grid-cols-[7rem_1fr] gap-3">
        <Input
          id="account-code"
          label="Code"
          required
          inputMode="numeric"
          placeholder="6060"
          className="tabular"
          disabled={editing}
          value={form.code}
          onChange={(event) => set({ code: event.target.value })}
        />
        <Input
          id="account-name"
          label="Account name"
          required
          placeholder="Travel & conveyance"
          value={form.name}
          onChange={(event) => set({ name: event.target.value })}
        />
      </div>

      <Select
        id="account-group"
        label="Group"
        required
        options={GROUP_OPTIONS}
        value={form.group}
        disabled={groupLocked}
        description={
          groupLocked
            ? 'Locked — the group decides which column of the trial balance this lands in.'
            : 'This decides which side of the trial balance the balance appears on.'
        }
        onChange={(event) => set({ group: event.target.value })}
      />

      <Switch
        id="account-subledger"
        label="Holds a sub-ledger"
        description="A balance kept per counterparty rather than as one lump, the way vendor payables are."
        checked={form.isSubLedger}
        onChange={(event) => set({ isSubLedger: event.target.checked })}
      />

      {editing && account.balance !== 0 && (
        <InlineAlert tone="info" title="This account carries a balance">
          It cannot be deactivated or moved to another group until the balance is cleared.
        </InlineAlert>
      )}
    </FormDrawer>
  )
}
