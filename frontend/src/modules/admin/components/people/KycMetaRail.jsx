import { Badge, Icon } from '../../../../components/ui'
import { KeyValueList, SectionCard } from '../display'
import { ReviewProgress } from './KycDecision'
import { RazorpaySyncPanel } from './RazorpaySyncPanel'

export function KycMetaRail({ application, vendorId }) {
  const { business, payout, policyAcceptances, documents } = application

  return (
    <div className="flex flex-col gap-4">
      <ReviewProgress documents={documents} />

      <SectionCard title="Business details">
        <div className="px-4 py-2">
          <KeyValueList
            items={[
              { label: 'Constitution', value: business.constitution },
              { label: 'PAN', value: <span className="tabular">{business.pan}</span> },
              { label: 'GSTIN', value: <span className="tabular">{business.gstin}</span> },
              { label: 'Categories', value: business.categories.join(', ') },
              { label: 'Pickup', value: <span className="tabular">{business.pickupPincode}</span> },
              { label: 'Contact', value: business.contactName },
              { label: 'Phone', value: <span className="tabular">{business.contactPhone}</span> },
            ]}
          />
        </div>
      </SectionCard>

      <SectionCard title="Payout account">
        <div className="px-4 py-2">
          <KeyValueList
            items={[
              { label: 'Bank', value: payout.bank },
              { label: 'Account', value: <span className="tabular">{payout.accountMasked}</span> },
              { label: 'IFSC', value: <span className="tabular">{payout.ifsc}</span> },
              {
                label: 'Route account',
                value: (
                  <Badge tone={payout.routeLinked ? 'success' : 'warning'} size="sm" dot>
                    {payout.routeLinked ? 'Linked' : 'Not yet linked'}
                  </Badge>
                ),
              },
            ]}
          />
        </div>
        <p className="border-t border-border-subtle px-4 py-2.5 text-2xs leading-relaxed text-ink-faint">
          A Razorpay Route linked account is created on approval. Settlements cannot run until it
          exists — the platform may not hold and disburse vendor funds itself.
        </p>
      </SectionCard>

      <RazorpaySyncPanel vendorId={vendorId || application.vendorId} routeLinkedHint={payout.routeLinked} />

      <SectionCard title="Policy acceptances">
        <ul className="flex flex-col gap-2.5 px-4 py-3.5">
          {policyAcceptances.map((acceptance) => (
            <li key={acceptance.policy} className="flex items-start gap-2.5">
              <Icon
                name={acceptance.superseded ? 'pending' : 'check'}
                className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${acceptance.superseded ? 'text-warning-700' : 'text-success-700'}`}
              />
              <span className="min-w-0">
                <span className="block text-xs font-semibold text-slate-900">
                  {acceptance.policy} {acceptance.version}
                </span>
                {acceptance.superseded ? (
                  <span className="block text-2xs text-warning-700">
                    Superseded — re-acceptance required
                  </span>
                ) : (
                  <span className="tabular block text-2xs text-ink-faint">
                    {acceptance.acceptedAt} · {acceptance.ip}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </SectionCard>
    </div>
  )
}
