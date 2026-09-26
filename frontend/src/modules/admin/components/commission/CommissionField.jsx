import { useState } from 'react'
import { Button, Input, Modal, SegmentedControl } from '../../../../components/ui'
import { PermissionGate } from '../feedback'
import { ADMIN_PERMISSIONS } from '../../constants'

// The one small "commission or skip" control, used wherever the admin is
// already working: approving a seller, approving a seller's category or
// product, creating or editing a category. It writes that target's own rule
// in the commission engine (Product > Seller > Category > default); "Skip"
// writes nothing and the next level down applies.

const MODE_ITEMS = [
  { id: 'skip', label: 'Skip' },
  { id: 'set', label: 'Set commission' },
]
const TYPE_ITEMS = [
  { id: 'PERCENTAGE', label: '% of sale' },
  { id: 'FIXED', label: '₹ per unit' },
]

// { mode, type, value } -> the API payload, or null when skipped/empty.
export function commissionPayload(state) {
  if (!state || state.mode !== 'set' || String(state.value).trim() === '') return null
  return { type: state.type, value: Number(state.value) }
}

export function initialCommission(existing) {
  return existing
    ? { mode: 'set', type: existing.type, value: String(existing.value) }
    : { mode: 'skip', type: 'PERCENTAGE', value: '' }
}

export function commissionLabel(commission) {
  if (!commission) return null
  return commission.type === 'FIXED' ? `₹${commission.value} / unit` : `${commission.value}%`
}

export function CommissionField({ id, state, onChange, skipHint }) {
  const set = (patch) => onChange({ ...state, ...patch })
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface-subtle p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-slate-900">Commission</p>
        <SegmentedControl items={MODE_ITEMS} activeId={state.mode} onChange={(mode) => set({ mode })} />
      </div>

      {state.mode === 'skip' ? (
        <p className="text-2xs text-ink-subtle">{skipHint}</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          <SegmentedControl items={TYPE_ITEMS} activeId={state.type} onChange={(type) => set({ type })} />
          <Input
            id={`${id}-value`}
            label={state.type === 'FIXED' ? 'Amount per unit sold' : 'Commission rate'}
            type="number"
            min="0"
            step="0.01"
            size="control"
            suffix={state.type === 'FIXED' ? '₹' : '%'}
            placeholder={state.type === 'FIXED' ? 'e.g. 20' : 'e.g. 10'}
            value={state.value}
            onChange={(event) => set({ value: event.target.value })}
          />
        </div>
      )}
    </div>
  )
}

// Wraps a form section so a staff member without commission rights never
// sees a field the server would refuse.
export function CommissionGate({ children }) {
  return <PermissionGate permission={ADMIN_PERMISSIONS.ACCOUNTING_COMMISSION_MANAGE}>{children}</PermissionGate>
}

// Approve dialog: set a commission, or skip it. `onApprove(commission|null)`.
// `initial` pre-fills an existing rate; the two button labels can be changed
// for prompts that are not an approval (e.g. turning auto-approval on).
export function ApproveWithCommissionDialog({
  isOpen,
  onClose,
  title,
  description,
  skipHint,
  isSubmitting,
  onApprove,
  initial = null,
  skipLabel = 'Skip & approve',
  confirmLabel = (label) => `Approve with ${label}`,
}) {
  const [state, setState] = useState(() => initialCommission(initial))
  const payload = commissionPayload(state)
  const wantsRate = state.mode === 'set'

  function close() {
    setState(initialCommission(initial))
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !isSubmitting && close()}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={() => onApprove(null)} disabled={isSubmitting}>
            {skipLabel}
          </Button>
          <PermissionGate permission={ADMIN_PERMISSIONS.ACCOUNTING_COMMISSION_MANAGE}>
            <Button
              icon="check"
              onClick={() => onApprove(payload)}
              disabled={!wantsRate || !payload || isSubmitting}
              isLoading={isSubmitting}
            >
              {confirmLabel(payload ? commissionLabel(payload) : 'commission')}
            </Button>
          </PermissionGate>
        </>
      }
    >
      <PermissionGate
        permission={ADMIN_PERMISSIONS.ACCOUNTING_COMMISSION_MANAGE}
        fallback={<p className="text-xs text-ink-subtle">{skipHint} You do not have permission to set commission.</p>}
      >
        <CommissionField id="approve-commission" state={state} onChange={setState} skipHint={skipHint} />
      </PermissionGate>
    </Modal>
  )
}
