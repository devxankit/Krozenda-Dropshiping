import { useForm } from 'react-hook-form'
import { Button, Modal, PasswordInput } from '../../../../components/ui'
import { zodResolver } from '../../lib/zodResolver'
import { changePasswordSchema } from '../../schemas/staffSchema'

export function ChangePasswordDialog({ isOpen, ...props }) {
  if (!isOpen) return null
  return <ChangePasswordDialogBody {...props} />
}

function ChangePasswordDialogBody({ onClose, staff, onSubmit, isSubmitting }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  })

  function submit(values) {
    onSubmit({ id: staff.id, password: values.password })
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Change password for ${staff?.name || 'staff'}`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" size="control" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button form="change-password-form" type="submit" size="control" isLoading={isSubmitting}>
            Update password
          </Button>
        </>
      }
    >
      <form id="change-password-form" onSubmit={handleSubmit(submit)} noValidate className="flex flex-col gap-4">
        <PasswordInput
          id="password"
          label="New password"
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
      </form>
    </Modal>
  )
}
