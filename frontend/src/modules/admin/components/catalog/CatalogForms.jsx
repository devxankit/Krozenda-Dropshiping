import { useState } from 'react'
import { Input, Select, Textarea } from '../../../../components/ui'
import { FormDrawer } from '../forms'
import { ConfirmDialog } from '../overlay/ConfirmDialog'
import {
  attributeWriteSchema,
  categoryWriteSchema,
  inventoryAdjustSchema,
} from '../../schemas/catalogSchema'

const DEPTH_OPTIONS = [
  { value: '0', label: 'Top level' },
  { value: '1', label: 'Sub-category' },
]

const TYPE_OPTIONS = [
  { value: 'select', label: 'Select — one value' },
  { value: 'multiselect', label: 'Multi-select — several values' },
  { value: 'text', label: 'Free text' },
  { value: 'number', label: 'Number' },
]

export function CategoryFormDrawer({ isOpen, onClose, category, writer }) {
  const editing = Boolean(category)
  const [form, setForm] = useState(() => ({
    name: category?.name ?? '',
    depth: String(category?.depth ?? 0),
    commissionRate: category?.commissionRate == null ? '' : String(category.commissionRate),
  }))
  const [issue, setIssue] = useState(null)

  const mutation = editing ? writer.update : writer.create

  function handleSubmit(event) {
    event.preventDefault()
    const payload = {
      name: form.name,
      depth: Number(form.depth),
      commissionRate: form.commissionRate === '' ? null : Number(form.commissionRate),
    }
    const result = categoryWriteSchema.safeParse(payload)
    if (!result.success) {
      setIssue(result.error.issues[0].message)
      return
    }
    setIssue(null)
    mutation.run(editing ? { id: category.id, ...payload } : payload)
  }

  return (
    <FormDrawer
      isOpen={isOpen}
      onClose={onClose}
      title={editing ? `Edit ${category.name}` : 'New category'}
      description="A commission rate set here is inherited by children unless they set their own."
      submitLabel={editing ? 'Save changes' : 'Create category'}
      isSubmitting={mutation.isSubmitting}
      error={issue ? { message: issue } : mutation.error}
      onSubmit={handleSubmit}
    >
      <Input
        id="category-name"
        label="Name"
        required
        value={form.name}
        onChange={(event) => setForm((c) => ({ ...c, name: event.target.value }))}
      />
      <Select
        id="category-depth"
        label="Level"
        options={DEPTH_OPTIONS}
        value={form.depth}
        disabled={editing}
        onChange={(event) => setForm((c) => ({ ...c, depth: event.target.value }))}
      />
      <Input
        id="category-commission"
        label="Commission rate"
        suffix="%"
        inputMode="decimal"
        placeholder="Leave blank to inherit"
        className="tabular text-right"
        description="Blank means it inherits from the parent category."
        value={form.commissionRate}
        onChange={(event) => setForm((c) => ({ ...c, commissionRate: event.target.value }))}
      />
    </FormDrawer>
  )
}

export function AttributeFormDrawer({ isOpen, onClose, attribute, writer }) {
  const editing = Boolean(attribute)
  const [form, setForm] = useState(() => ({
    name: attribute?.name ?? '',
    type: attribute?.type ?? 'select',
    values: (attribute?.values ?? []).join('\n'),
  }))
  const [issue, setIssue] = useState(null)

  const mutation = editing ? writer.update : writer.create

  function handleSubmit(event) {
    event.preventDefault()
    const payload = {
      name: form.name,
      type: form.type,
      values: form.values.split('\n').map((value) => value.trim()).filter(Boolean),
    }
    const result = attributeWriteSchema.safeParse(payload)
    if (!result.success) {
      setIssue(result.error.issues[0].message)
      return
    }
    setIssue(null)
    mutation.run(editing ? { id: attribute.id, ...payload } : payload)
  }

  return (
    <FormDrawer
      isOpen={isOpen}
      onClose={onClose}
      title={editing ? `Edit ${attribute.name}` : 'New attribute'}
      description="The option set a Variable product builds its variants from."
      submitLabel={editing ? 'Save changes' : 'Create attribute'}
      isSubmitting={mutation.isSubmitting}
      error={issue ? { message: issue } : mutation.error}
      onSubmit={handleSubmit}
    >
      <Input
        id="attribute-name"
        label="Name"
        required
        placeholder="Size, Colour, Capacity…"
        value={form.name}
        onChange={(event) => setForm((c) => ({ ...c, name: event.target.value }))}
      />
      <Select
        id="attribute-type"
        label="Type"
        options={TYPE_OPTIONS}
        value={form.type}
        onChange={(event) => setForm((c) => ({ ...c, type: event.target.value }))}
      />
      <Textarea
        id="attribute-values"
        label="Values"
        rows={6}
        required
        placeholder={'One per line\nS\nM\nL'}
        description="One value per line."
        value={form.values}
        onChange={(event) => setForm((c) => ({ ...c, values: event.target.value }))}
      />
    </FormDrawer>
  )
}

export function InventoryAdjustDialog({ isOpen, onClose, row, adjust }) {
  const [onHand, setOnHand] = useState(String(row.onHand))
  const [reason, setReason] = useState('')
  const [issue, setIssue] = useState(null)

  const next = Number(onHand)
  const projected = Number.isFinite(next) ? next - row.reserved : null

  function submit() {
    const payload = { onHand: Math.round(next), reason }
    const result = inventoryAdjustSchema.safeParse(payload)
    if (!result.success) {
      setIssue(result.error.issues[0].message)
      return
    }
    setIssue(null)
    adjust.run({ id: row.id, ...payload })
  }

  return (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={submit}
      title={`Adjust stock — ${row.sku}`}
      description={`${row.onHand} on hand today, ${row.reserved} of them reserved by open carts.`}
      confirmLabel="Post adjustment"
      tone="primary"
      isSubmitting={adjust.isSubmitting}
    >
      <div className="flex flex-col gap-3">
        <Input
          id="inventory-onhand"
          label="New on-hand count"
          required
          inputMode="numeric"
          className="tabular text-right"
          value={onHand}
          description={projected == null ? undefined : `${projected} would be available to sell`}
          onChange={(event) => setOnHand(event.target.value)}
        />
        <Textarea
          id="inventory-reason"
          label="Reason"
          rows={2}
          required
          placeholder="Cycle count, damage write-off, receipt correction…"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
        {(issue || adjust.error) && (
          <p className="text-xs text-danger-700">{issue || adjust.error.message}</p>
        )}
      </div>
    </ConfirmDialog>
  )
}
