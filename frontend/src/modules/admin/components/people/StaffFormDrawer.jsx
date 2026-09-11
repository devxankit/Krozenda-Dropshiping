import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Avatar, Icon, Input, PasswordInput, Select, Checkbox } from '../../../../components/ui'
import { FormDrawer } from '../forms/FormDrawer'
import { zodResolver } from '../../lib/zodResolver'
import { staffCreateSchema, staffEditSchema } from '../../schemas/staffSchema'
import { useRoleListController } from '../../controllers/useRoleManagementController'

const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
]

const EMPTY_VALUES = {
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
  roleId: '',
  mobileNumber: '',
  gender: '',
  dob: '',
}

function toFormValues(staff) {
  if (!staff) return EMPTY_VALUES
  return {
    name: staff.name || '',
    email: staff.email || '',
    roleId: staff.roleId || '',
    mobileNumber: staff.mobileNumber || '',
    gender: staff.gender || '',
    dob: staff.dob ? staff.dob.slice(0, 10) : '',
  }
}

function SectionLabel({ children }) {
  return <p className="text-2xs font-semibold uppercase tracking-wider text-ink-faint">{children}</p>
}

// One drawer for both create and edit — the only structural difference is
// the password field, which only exists on create (edits go through the
// dedicated "Change password" action).
//
// Closed means unmounted (not just hidden), same as ConfirmDialog — that is
// what gives every open a clean initial state without an effect resetting
// it mid-render.
export function StaffFormDrawer({ isOpen, ...props }) {
  if (!isOpen) return null
  return <StaffFormDrawerBody {...props} />
}

function StaffFormDrawerBody({ onClose, staff, onSubmit, isSubmitting, error }) {
  const isEdit = Boolean(staff)
  const [imageFile, setImageFile] = useState(null)
  const [isActive, setIsActive] = useState(staff?.isActive ?? true)
  const roles = useRoleListController()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(isEdit ? staffEditSchema : staffCreateSchema),
    defaultValues: toFormValues(staff),
  })

  function submit({ confirmPassword: _confirmPassword, ...values }) {
    onSubmit({
      ...values,
      ...(isEdit ? { id: staff.id } : {}),
      image: imageFile || undefined,
      isActive,
    })
  }

  const previewSrc = imageFile ? URL.createObjectURL(imageFile) : staff?.image || undefined

  return (
    <FormDrawer
      isOpen
      onClose={onClose}
      title={isEdit ? 'Edit staff' : 'Add staff'}
      description={
        isEdit
          ? 'Update this person’s details and sidebar access.'
          : 'They will be able to sign in with the email and password set here.'
      }
      submitLabel={isEdit ? 'Save changes' : 'Create staff'}
      isSubmitting={isSubmitting}
      error={error}
      onSubmit={handleSubmit(submit)}
      width="lg"
    >
      <div className="flex flex-col gap-4">
        <SectionLabel>Photo</SectionLabel>
        <div className="flex items-center gap-4 rounded-lg border border-dashed border-border-strong bg-surface-muted/60 p-4">
          <Avatar name={staff?.name} src={previewSrc} size="lg" />
          <div className="flex flex-col gap-1">
            <label className="inline-flex w-fit cursor-pointer items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700">
              <Icon name="add" className="h-3.5 w-3.5" />
              {previewSrc ? 'Change photo' : 'Upload photo'}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => setImageFile(event.target.files?.[0] || null)}
              />
            </label>
            <p className="text-2xs text-ink-faint">PNG or JPG, square images look best.</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <SectionLabel>Basic details</SectionLabel>

        <div className="grid grid-cols-2 gap-3">
          <Input id="name" label="Name" required error={errors.name?.message} {...register('name')} />
          <Input
            id="email"
            type="email"
            label="Email"
            required
            error={errors.email?.message}
            {...register('email')}
          />
        </div>

        <Select
          id="roleId"
          label="Role"
          placeholder={roles.isLoading ? 'Loading roles…' : 'Select a role'}
          description={
            roles.items.length === 0 && !roles.isLoading
              ? 'No roles yet — create one from the Roles tab first.'
              : undefined
          }
          required
          options={roles.items.map((item) => ({ value: item.id, label: item.name }))}
          error={errors.roleId?.message}
          {...register('roleId')}
        />

        {!isEdit && (
          <div className="grid grid-cols-2 gap-3">
            <PasswordInput
              id="password"
              label="Password"
              description="They’ll use this to sign in."
              required
              error={errors.password?.message}
              {...register('password')}
            />
            <PasswordInput
              id="confirmPassword"
              label="Confirm password"
              required
              error={errors.confirmPassword?.message}
              {...register('confirmPassword')}
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Input
            id="mobileNumber"
            label="Mobile number"
            error={errors.mobileNumber?.message}
            {...register('mobileNumber')}
          />
          <Select
            id="gender"
            label="Gender"
            placeholder="Select"
            options={GENDER_OPTIONS}
            error={errors.gender?.message}
            {...register('gender')}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            id="dob"
            type="date"
            label="Date of birth"
            error={errors.dob?.message}
            {...register('dob')}
          />
          <div className="flex items-end pb-2.5">
            <Checkbox
              id="isActive"
              label="Active"
              description="Inactive staff cannot sign in"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
            />
          </div>
        </div>
      </div>
    </FormDrawer>
  )
}
