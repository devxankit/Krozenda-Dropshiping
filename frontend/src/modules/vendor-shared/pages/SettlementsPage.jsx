import { useState } from 'react'
import { Badge, Button, Skeleton } from '../../../components/ui'
import { MoneyCell } from '../../admin/components/display'
import { PageHeader } from '../../admin/components/shell/PageHeader'
import { PageBody } from '../../admin/components/shell/PageBody'
import { DataTable } from '../../admin/components/data/DataTable'
import { useVendorSettlementsController } from '../controllers/useVendorController'
import { VENDOR_SETTLEMENT_COLUMNS } from '../tableColumns/vendorColumns'

export function SettlementsPage() {
  const { data, isLoading } = useVendorSettlementsController()
  const [filterState, setFilterState] = useState('all')

  const settlements = data || []
  const filteredSettlements =
    filterState === 'all' ? settlements : settlements.filter((s) => s.status === filterState)

  const totalSettled = settlements
    .filter((s) => s.status === 'settled')
    .reduce((acc, curr) => acc + curr.netPayout, 0)

  const totalEligible = settlements
    .filter((s) => s.status === 'eligible')
    .reduce((acc, curr) => acc + curr.netPayout, 0)

  return (
    <PageBody>
      <PageHeader
        title="Payouts & Settlements"
        subtitle="Razorpay Route direct split settlements, commission deductions, and bank transfer history."
        actions={
          <Button variant="secondary" size="sm" onClick={() => alert('Exporting payout statement CSV...')}>
            Export Payout Statement
          </Button>
        }
      />

      {/* Overview Stat Cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-5 shadow-2xs">
          <span className="text-2xs font-semibold uppercase tracking-wider text-ink-subtle">
            Total Settled Payout
          </span>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            <MoneyCell amount={totalSettled} />
          </div>
          <span className="mt-1 block text-2xs text-emerald-600 font-medium">
            Transferred directly to HDFC Bank ****4892
          </span>
        </div>

        <div className="rounded-xl border border-border bg-surface p-5 shadow-2xs">
          <span className="text-2xs font-semibold uppercase tracking-wider text-ink-subtle">
            Pending / In-Escrow
          </span>
          <div className="mt-2 text-2xl font-bold text-amber-600">
            <MoneyCell amount={totalEligible} />
          </div>
          <span className="mt-1 block text-2xs text-ink-subtle">
            Scheduled for release upon buyer delivery confirmation (T+2)
          </span>
        </div>

        <div className="rounded-xl border border-border bg-surface p-5 shadow-2xs">
          <span className="text-2xs font-semibold uppercase tracking-wider text-ink-subtle">
            Razorpay Route Integration
          </span>
          <div className="mt-2 flex items-center gap-2">
            <Badge tone="success" size="md">
              Active & Verified
            </Badge>
          </div>
          <span className="mt-1 block font-mono text-2xs text-ink-subtle">
            Linked Account: acc_Lp982401K
          </span>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="mb-4 flex items-center gap-2 border-b border-border pb-2">
        <button
          onClick={() => setFilterState('all')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            filterState === 'all'
              ? 'bg-slate-900 text-white'
              : 'text-ink-muted hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          All Transfers ({settlements.length})
        </button>
        <button
          onClick={() => setFilterState('settled')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            filterState === 'settled'
              ? 'bg-slate-900 text-white'
              : 'text-ink-muted hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          Completed Settlements
        </button>
        <button
          onClick={() => setFilterState('eligible')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            filterState === 'eligible'
              ? 'bg-slate-900 text-white'
              : 'text-ink-muted hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          Pending / Eligible
        </button>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : (
        <div className="rounded-xl border border-border bg-surface shadow-2xs overflow-hidden">
          <DataTable columns={VENDOR_SETTLEMENT_COLUMNS} data={filteredSettlements} />
        </div>
      )}
    </PageBody>
  )
}
