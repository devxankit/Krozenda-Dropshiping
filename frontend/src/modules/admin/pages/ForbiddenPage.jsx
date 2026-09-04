import { Link } from 'react-router-dom'
import { Button, Icon } from '../../../components/ui'
import { ADMIN_ROUTES } from '../../../config/routes'
import { PageBody } from '../components/shell'

export function ForbiddenPage() {
  return (
    <PageBody>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-24 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-warning-50 text-warning-700">
          <Icon name="lock" className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Your role cannot open this
          </h1>
          <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-ink-subtle">
            The screen exists, but the permissions attached to your role do not include it. Ask a
            Super Admin to widen your role if you need access.
          </p>
        </div>
        <Link to={ADMIN_ROUTES.DASHBOARD}>
          <Button variant="secondary" size="control" icon="dashboard">
            Back to dashboard
          </Button>
        </Link>
      </div>
    </PageBody>
  )
}
