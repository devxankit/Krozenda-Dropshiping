import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Input } from '../../../../components/ui'
import { FormDrawer } from '../forms/FormDrawer'
import { zodResolver } from '../../lib/zodResolver'
import { roleSchema } from '../../schemas/roleSchema'
import { PermissionPicker } from './PermissionPicker'

// Closed means unmounted, same as every other drawer/dialog in this module —
// see StaffFormDrawer for why (gives every open a clean initial state
// without an effect resetting it mid-render).
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
    formState: { errors },
  } = useForm({
    resolver: zodResolver(roleSchema),
    defaultValues: { name: role?.name || '' },
  })

  function submit(values) {
    onSubmit({
      ...values,
      ...(isEdit ? { id: role.id } : {}),
      permissions,
    })
  }

  return (
    <FormDrawer
      isOpen
      onClose={onClose}
      title={isEdit ? 'Edit role' : 'Create role'}
      description="Name this role, then choose which sidebar modules it grants. Staff are assigned a role instead of picking modules individually."
      submitLabel={isEdit ? 'Save changes' : 'Create role'}
      isSubmitting={isSubmitting}
      error={error}
      onSubmit={handleSubmit(submit)}
      width="lg"
    >
      <Input id="name" label="Role name" required error={errors.name?.message} {...register('name')} />

      <div className="flex flex-col gap-2 border-t border-border-subtle pt-4">
        <p className="text-2xs font-semibold uppercase tracking-wider text-ink-faint">Permissions</p>
        <PermissionPicker value={permissions} onChange={setPermissions} />
      </div>
    </FormDrawer>
  )
}
