import { useParams } from 'react-router-dom'
import { Badge, Button, Switch } from '../../../../components/ui'
import { PageBody, PageHeader } from '../../components/shell'
import { ErrorState, InlineAlert, PageSkeleton, PermissionGate } from '../../components/feedback'
import { SectionCard } from '../../components/display'
import { FormActions, UnsavedIndicator } from '../../components/forms'
import { ADMIN_PERMISSIONS } from '../../constants'
import { useRoleDetailController } from '../../controllers/usePeopleController'

// The permission matrix. Toggling here is what "permissions are data, not
// hardcoded" means in practice — nothing in the panel branches on a role name.
export function RoleDetailPage() {
  const { roleId } = useParams()
  const { data: role, isLoading, error, refetch } = useRoleDetailController(roleId)

  if (isLoading) {
    return (
      <PageBody>
        <PageSkeleton rows={3} />
      </PageBody>
    )
  }
  if (error) {
    return (
      <PageBody>
        <ErrorState error={error} onRetry={refetch} />
      </PageBody>
    )
  }

  const granted = role.groups.flatMap((g) => g.permissions).filter((p) => p.granted).length
  const total = role.groups.flatMap((g) => g.permissions).length

  return (
    <PageBody>
      <PageHeader
        title={role.name}
        trail={[{ label: role.name }]}
        description={role.description}
        actions={
          <PermissionGate permission={ADMIN_PERMISSIONS.ROLES_MANAGE}>
            <Button variant="secondary" size="control" icon="copy">
              Duplicate role
            </Button>
            <Button variant="dangerOutline" size="control" disabled={role.immutable}>
              Delete role
            </Button>
          </PermissionGate>
        }
      >
        <div className="mt-1.5 flex flex-wrap items-center gap-2.5 text-xs text-ink-subtle">
          <Badge tone={role.immutable ? 'accent' : 'brand'} size="sm">
            {role.surface}
          </Badge>
          <span className="tabular">
            {granted} of {total} permissions
          </span>
          <span className="text-border-strong">·</span>
          <span>
            {role.memberCount} {role.memberCount === 1 ? 'member' : 'members'}
          </span>
        </div>
      </PageHeader>

      {role.immutable && (
        <InlineAlert tone="info" title="This role cannot be edited">
          Super Admin holds every permission by definition, and its audit trail is immutable.
          Create a new role instead of narrowing this one.
        </InlineAlert>
      )}

      {role.groups.map((group) => (
        <SectionCard key={group.label} title={group.label}>
          <ul className="divide-y divide-border-subtle">
            {group.permissions.map((permission) => (
              <li
                key={permission.key}
                className="flex items-center gap-4 px-4 py-2.5"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold text-slate-900">
                    {permission.label}
                  </span>
                  <span className="block text-2xs leading-snug text-ink-faint">
                    {permission.description}
                  </span>
                </span>
                <code className="tabular hidden shrink-0 rounded bg-surface-sunken px-1.5 py-0.5 text-2xs text-ink-faint lg:block">
                  {permission.key}
                </code>
                <Switch
                  id={permission.key}
                  checked={permission.granted}
                  disabled={role.immutable}
                  onChange={() => {}}
                />
              </li>
            ))}
          </ul>
        </SectionCard>
      ))}

      <FormActions
        status={<UnsavedIndicator count={0} />}
        note="Saving writes an entry to the audit log"
      >
        <Button variant="quiet" size="control">
          Discard
        </Button>
        <Button size="control" disabled={role.immutable}>
          Save permissions
        </Button>
      </FormActions>
    </PageBody>
  )
}
