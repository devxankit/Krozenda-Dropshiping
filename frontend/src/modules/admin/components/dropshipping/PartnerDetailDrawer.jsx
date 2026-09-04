import { Badge, Button } from '../../../../components/ui'
import { Drawer } from '../overlay/Drawer'
import { MoneyCell } from '../display'
import { toast } from '../../stores/toastStore'

export function PartnerDetailDrawer({ partner, isOpen, onClose, onToggleStatus }) {
  if (!partner) return null

  function handleLinkRoute() {
    toast.success(
      'Razorpay Route Account Linked',
      `Linked account created for ${partner.name}. Split settlements activated.`,
    )
  }

  function handleToggleActive() {
    const nextStatus = partner.status === 'active' ? 'suspended' : 'active'
    onToggleStatus?.(partner.id, nextStatus)
    toast.info(
      `Partner ${nextStatus.toUpperCase()}`,
      `${partner.name} status updated to ${nextStatus}.`,
    )
  }

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={partner.name}
      description={`${partner.supplierType} · ${partner.city}`}
      width="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button
            variant={partner.status === 'active' ? 'danger' : 'primary'}
            onClick={handleToggleActive}
          >
            {partner.status === 'active' ? 'Suspend partner' : 'Activate partner'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-6 p-5">
        {/* KPI Row */}
        <div className="grid grid-cols-3 gap-3 rounded-lg border border-border bg-surface-muted p-4">
          <div>
            <p className="text-2xs font-semibold uppercase text-ink-faint">Live SKUs</p>
            <p className="mt-1 text-xl font-bold text-slate-900">{partner.products}</p>
          </div>
          <div>
            <p className="text-2xs font-semibold uppercase text-ink-faint">Fulfilled Orders</p>
            <p className="mt-1 text-xl font-bold text-slate-900">{partner.ordersCount}</p>
          </div>
          <div>
            <p className="text-2xs font-semibold uppercase text-ink-faint">Gross Sales</p>
            <div className="mt-1">
              <MoneyCell amount={partner.revenue} compact />
            </div>
          </div>
        </div>

        {/* Account Details */}
        <div className="flex flex-col gap-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
            Supplier Account Overview
          </h3>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="flex flex-col gap-0.5">
              <span className="text-ink-subtle">GSTIN Registration</span>
              <span className="font-mono font-medium text-slate-900">
                {partner.gstin || 'Pending document upload'}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-ink-subtle">Integration Adapter</span>
              <Badge tone={partner.integrationMode.includes('API') ? 'brand' : 'neutral'} size="sm">
                {partner.integrationMode}
              </Badge>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-ink-subtle">KYC Application</span>
              <Badge tone={partner.kycStatus === 'approved' ? 'success' : 'warning'} size="sm">
                {partner.kycStatus}
              </Badge>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-ink-subtle">Joined Date</span>
              <span className="font-medium text-slate-900">{partner.joinedAt}</span>
            </div>
          </div>
        </div>

        {/* Razorpay Route Linked Account Box */}
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold text-slate-900">Razorpay Route Settlement</h4>
              <p className="mt-0.5 text-xs text-ink-subtle">
                RBI compliance requires direct split payouts via Razorpay Route linked accounts.
              </p>
            </div>
            <Badge tone={partner.routeLinked ? 'success' : 'warning'} size="sm">
              {partner.routeLinked ? 'Linked' : 'Not Linked'}
            </Badge>
          </div>

          {!partner.routeLinked && (
            <div className="mt-3 border-t border-border pt-3">
              <Button size="xs" variant="secondary" onClick={handleLinkRoute} icon="link">
                Link Razorpay Route account now
              </Button>
            </div>
          )}
        </div>
      </div>
    </Drawer>
  )
}
