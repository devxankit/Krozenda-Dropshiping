import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Badge, Icon, Input } from '../../../../components/ui'
import { FormDrawer } from '../forms/FormDrawer'
import { zodResolver } from '../../lib/zodResolver'
import { roleSchema } from '../../schemas/roleSchema'
import { PermissionPicker } from './PermissionPicker'

export function RoleFormDrawer({ isOpen, ...props }) {
  if (!isOpen) return null
  return <RoleFormDrawerBody {...props} />
}

function RoleFormDrawerBody({ onClose, role, onSubmit, isSubmitting, error }) {
  const isEdit = Boolean(role)
  const [permissions, setPermissions] = useState(role?.permissions || [])

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(roleSchema),
    defaultValues: { name: role?.name || '' },
  })

  const watchedName = watch('name')

  function submit(values) {
    onSubmit({
      ...values,
      ...(isEdit ? { id: role.id } : {}),
      permissions,
      isActive: role?.isActive !== false,
    })
  }

  return (
    <FormDrawer
      isOpen
      onClose={onClose}
      title={isEdit ? `Edit Role: ${role.name}` : 'Create Security Role'}
      description="Define role identity and configure granted access privileges across functional platform domains."
      submitLabel={isEdit ? 'Save changes' : 'Create role'}
      isSubmitting={isSubmitting}
      error={error}
      onSubmit={handleSubmit(submit)}
      width="lg"
    >
      <Input
        id="name"
        label="Role Name"
        required
        placeholder="e.g. Catalog Manager, Fulfilment Specialist"
        error={errors.name?.message}
        {...register('name')}
      />

      {/* Real-time Role Preview */}
      <div className="flex flex-col gap-2 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4">
        <div className="flex items-center justify-between">
          <span className="text-2xs font-bold uppercase tracking-wider text-slate-400">
            Live Role Preview
          </span>
          <span className="text-2xs text-slate-400 font-medium">Security Profile</span>
        </div>
        <div className="flex items-center gap-3.5 rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-50 to-brand-50 text-brand-700 ring-1 ring-brand-200/60 font-bold">
            <Icon name="roles" className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-slate-900 text-sm truncate">
              {watchedName || 'Role Name'}
            </p>
            <div className="mt-1 flex items-center gap-2 text-2xs">
              <Badge tone="brand" size="sm">
                {permissions.length} modules granted
              </Badge>
              <Badge tone="success" dot size="sm">
                Active Role
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-slate-200/80 pt-4">
        <p className="text-2xs font-bold uppercase tracking-wider text-slate-500">Functional Permissions & Modules</p>
        <PermissionPicker value={permissions} onChange={setPermissions} />
      </div>
    </FormDrawer>
  )
}
