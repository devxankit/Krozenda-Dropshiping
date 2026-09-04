import { useForm } from 'react-hook-form'
import { Button, Icon, Input } from '../../../../components/ui'
import { AuthShell } from '../../components/auth/AuthShell'
import { InlineAlert } from '../../components/feedback'
import { useResetPasswordController } from '../../controllers/useAdminAuthController'
import { resetPasswordSchema } from '../../schemas/authSchema'
import { zodResolver } from '../../lib/zodResolver'

const RULES = Object.freeze([
  { label: 'At least 12 characters', test: (value) => value.length >= 12 },
  { label: 'One capital letter', test: (value) => /[A-Z]/.test(value) },
  { label: 'One number', test: (value) => /[0-9]/.test(value) },
])

export function ResetPasswordPage() {
  const { submit, isSubmitting, error } = useResetPasswordController()

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  })

  const password = watch('password') || ''

  return (
    <AuthShell
      title="Choose a new password"
      description="Admin passwords are held to a higher bar than buyer accounts, and all active sessions are signed out once this is saved."
    >
      <form className="flex flex-col gap-4" onSubmit={handleSubmit(submit)} noValidate>
        {error && (
          <InlineAlert tone="danger" title="That did not work">
            {error.message}
          </InlineAlert>
        )}

        <Input
          id="password"
          type="password"
          label="New password"
          icon="lock"
          autoComplete="new-password"
          error={errors.password?.message}
          {...register('password')}
        />

        <ul className="flex flex-col gap-1.5">
          {RULES.map((rule) => {
            const met = rule.test(password)
            return (
              <li
                key={rule.label}
                className={`flex items-center gap-2 text-xs ${met ? 'text-success-700' : 'text-ink-faint'}`}
              >
                <Icon name={met ? 'check' : 'remove'} className="h-3.5 w-3.5 shrink-0" />
                {rule.label}
              </li>
            )
          })}
        </ul>

        <Input
          id="confirmPassword"
          type="password"
          label="Confirm new password"
          icon="lock"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />

        <Button type="submit" size="md" isLoading={isSubmitting}>
          Save password and sign in
        </Button>
      </form>
    </AuthShell>
  )
}
