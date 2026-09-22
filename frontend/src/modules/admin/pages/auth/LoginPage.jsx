import { useForm } from 'react-hook-form'
import { Button, Input, PasswordInput } from '../../../../components/ui'
import { AuthShell } from '../../components/auth/AuthShell'
import { InlineAlert } from '../../components/feedback'
import { useAdminLoginController } from '../../controllers/useAdminAuthController'
import { adminLoginSchema } from '../../schemas/authSchema'
import { zodResolver } from '../../lib/zodResolver'

// Matches backend/.env's ADMIN_EMAIL/ADMIN_PASSWORD (seedAdmin.js bootstraps
// this account on first boot). Prefilled for demo convenience at the
// explicit request of the project owner, who was told this ships the
// super-admin password in the public bundle — swap or remove before any
// real deployment.
const DEMO_ADMIN = { email: 'admin@example.com', password: 'Krozenda@Admin123' }

export function LoginPage() {
  const { submit, isSubmitting, error } = useAdminLoginController()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(adminLoginSchema),
    defaultValues: DEMO_ADMIN,
  })

  return (
    <AuthShell
      title="Sign in to the admin panel"
      description="Use your Krozenda staff account. What you can see and do is scoped by the role assigned to you."
    >
      <form className="flex flex-col gap-4" onSubmit={handleSubmit(submit)} noValidate>
        {error && (
          <InlineAlert tone="danger" title="That did not work">
            {error.message}
          </InlineAlert>
        )}

        <Input
          id="email"
          type="email"
          label="Work email"
          icon="mail"
          placeholder="you@krozenda.in"
          autoComplete="username"
          error={errors.email?.message}
          {...register('email')}
        />

        <PasswordInput
          id="password"
          label="Password"
          icon="lock"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password')}
        />

        <Button type="submit" size="md" iconRight="arrowRight" isLoading={isSubmitting}>
          Continue
        </Button>
      </form>
    </AuthShell>
  )
}
