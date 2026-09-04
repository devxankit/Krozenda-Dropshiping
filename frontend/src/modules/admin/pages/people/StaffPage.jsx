import { Link } from 'react-router-dom'
import { Badge, Button, Icon, Table } from '../../../../components/ui'
import { adminPath } from '../../../../config/routes'
import { PageBody, PageHeader } from '../../components/shell'
import { ErrorState, InlineAlert, PageSkeleton, PermissionGate } from '../../components/feedback'
import { SectionCard } from '../../components/display'
import { ADMIN_PERMISSIONS } from '../../constants'
import { useRolesController, useStaffController } from '../../controllers/usePeopleController'
import { STAFF_COLUMNS } from '../../tableColumns/peopleColumns'

export function StaffPage() {
  const staff = useStaffController()
  const roles = useRolesController()

  if (staff.isLoading || roles.isLoading) {
    return (
      <PageBody>
        <PageSkeleton rows={3} />
      </PageBody>
    )
  }
  if (staff.error) {
    return (
      <PageBody>
        <ErrorState error={staff.error} onRetry={staff.refetch} />
      </PageBody>
    )
  }

  const without2fa = staff.data.items.filter((row) => !row.twoFactor && row.status === 'active')

  return (
    <PageBody>
      <PageHeader
        title="Staff & roles"
        description="Who can open the admin panel, and what their role lets them do once they are in."
        actions={
          <PermissionGate permission={ADMIN_PERMISSIONS.ROLES_MANAGE}>
            <Button variant="secondary" size="control" icon="add">
              New role
            </Button>
            <Button size="control" icon="add">
              Invite person
            </Button>
          </PermissionGate>
        }
      />

      {without2fa.length > 0 && (
        <InlineAlert
          tone="danger"
          title={`${without2fa.length} active accounts have no second factor`}
        >
          Two-factor is required on admin accounts. {without2fa.map((p) => p.name).join(', ')} can
          still sign in with a password alone until they enrol.
        </InlineAlert>
      )}

      <SectionCard title="People" description={`${staff.data.items.length} accounts`}>
        <Table
          className="rounded-none border-0 border-t"
          columns={STAFF_COLUMNS}
          data={staff.data.items}
          getRowKey={(row) => row.id}
          density="compact"
        />
      </SectionCard>

      <SectionCard
        title="Roles"
        description="Permissions are data, not code — editing a role takes effect on the next request"
      >
        <ul className="divide-y divide-border-subtle">
          {roles.data.items.map((role) => (
            <li key={role.id}>
              <Link
                to={adminPath.roleDetail(role.id)}
                className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-surface-muted"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-900">{role.name}</span>
                    {role.immutable && (
                      <Badge tone="accent" size="sm">
                        Immutable
                      </Badge>
                    )}
                  </span>
                  <span className="mt-0.5 block text-2xs leading-snug text-ink-subtle">
                    {role.description}
                  </span>
                </span>
                <span className="tabular shrink-0 text-2xs text-ink-faint">
                  {role.permissionCount} permissions
                </span>
                <span className="tabular shrink-0 text-2xs text-ink-faint">
                  {role.memberCount} {role.memberCount === 1 ? 'member' : 'members'}
                </span>
                <Icon name="chevronRight" className="h-3.5 w-3.5 shrink-0 text-border-strong" />
              </Link>
            </li>
          ))}
        </ul>
      </SectionCard>
    </PageBody>
  )
}
