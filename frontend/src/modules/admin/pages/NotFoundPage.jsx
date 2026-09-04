import { Link } from 'react-router-dom'
import { Button, Icon } from '../../../components/ui'
import { ADMIN_ROUTES } from '../../../config/routes'
import { PageBody } from '../components/shell'

export function NotFoundPage() {
  return (
    <PageBody>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-24 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-surface-muted text-ink-faint">
          <Icon name="search" className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            No screen at this address
          </h1>
          <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-ink-subtle">
            The link may be out of date, or the record it pointed at may have been removed. Press
            <kbd className="mx-1 rounded border border-border bg-surface px-1.5 py-0.5 text-2xs font-medium text-ink-muted">
              ⌘K
            </kbd>
            to jump to any screen.
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
