import { Link } from 'react-router-dom'
import { Button, Icon } from '../../../../components/ui'
import { ADMIN_ROUTES } from '../../../../config/routes'
import { AuthShell } from '../../components/auth/AuthShell'

const FACTS = Object.freeze([
  { label: 'Reason', value: 'Five failed verification attempts' },
  { label: 'Locked at', value: '2 Sep 2026, 14:08 IST' },
  { label: 'Unlocks at', value: '2 Sep 2026, 14:23 IST' },
  { label: 'Attempt from', value: '103.21.244.18 · Mumbai' },
])

export function LockedPage() {
  return (
    <AuthShell
      title="This account is temporarily locked"
      description="Too many failed verification attempts. Access reopens automatically in 15 minutes — a Super Admin can also lift the lock immediately."
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3 rounded-lg border border-danger-200 bg-danger-50 px-4 py-3.5">
          <Icon name="lock" className="mt-0.5 h-4 w-4 shrink-0 text-danger-700" />
          <p className="text-xs leading-relaxed text-danger-700">
            The lock and every attempt behind it are recorded in the audit log, and a login alert
            has been sent to the address on the account.
          </p>
        </div>

        <dl className="overflow-hidden rounded-lg border border-border">
          {FACTS.map((fact, index) => (
            <div
              key={fact.label}
              className={`flex items-baseline justify-between gap-4 px-4 py-2.5 text-xs ${index > 0 ? 'border-t border-border-subtle' : ''}`}
            >
              <dt className="text-ink-subtle">{fact.label}</dt>
              <dd className="text-right font-medium text-slate-900">{fact.value}</dd>
            </div>
          ))}
        </dl>

        <Link to={ADMIN_ROUTES.LOGIN}>
          <Button variant="secondary" size="md" icon="arrowLeft" className="w-full">
            Back to sign in
          </Button>
        </Link>
      </div>
    </AuthShell>
  )
}
