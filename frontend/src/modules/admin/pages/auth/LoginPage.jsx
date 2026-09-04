import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Button, Checkbox, Icon, Input } from '../../../../components/ui'
import { ADMIN_ROUTES } from '../../../../config/routes'
import { AuthShell } from '../../components/auth/AuthShell'
import { InlineAlert } from '../../components/feedback'
import { useAdminLoginController } from '../../controllers/useAdminAuthController'
import { adminLoginSchema } from '../../schemas/authSchema'
import { zodResolver } from '../../lib/zodResolver'

export function LoginPage() {
  const { submit, isSubmitting, error } = useAdminLoginController()
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(adminLoginSchema),
    defaultValues: { email: '', password: '', trustDevice: true },
  })

  return (
    <AuthShell
      title="Sign in to the admin panel"
      description="Use your Krozenda staff account. What you can see and do is scoped by the role assigned to you."
      aside={
        <p className="flex items-center gap-1.5 text-xs text-ink-subtle">
          Need an account?
          <span className="font-semibold text-brand-600">Contact your Super Admin</span>
        </p>
      }
      footer={<span className="tabular">Signing in from 103.21.244.18 · Mumbai</span>}
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

        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between">
            <label htmlFor="password" className="text-sm font-medium text-slate-700">
              Password
            </label>
            <Link
              to={ADMIN_ROUTES.FORGOT_PASSWORD}
              className="text-xs font-medium text-brand-600 hover:text-brand-700"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative flex items-center">
            <Icon
              name="lock"
              className="pointer-events-none absolute left-3 h-4 w-4 text-ink-faint"
            />
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              aria-invalid={errors.password ? true : undefined}
              className={`h-10 w-full rounded-md border bg-surface pl-9 pr-10 text-sm text-slate-900 placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                errors.password ? 'border-danger-500' : 'border-border'
              }`}
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-2 rounded p-1 text-ink-faint transition-colors hover:text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <Icon name={showPassword ? 'hide' : 'show'} />
            </button>
          </div>
          {errors.password && (
            <span className="text-xs text-danger-700">{errors.password.message}</span>
          )}
        </div>

        <Checkbox
          id="trustDevice"
          label="Trust this device for 30 days"
          checked={watch('trustDevice')}
          onChange={(event) => setValue('trustDevice', event.target.checked)}
        />

        <Button type="submit" size="md" iconRight="arrowRight" isLoading={isSubmitting}>
          Continue
        </Button>

        <InlineAlert tone="info">
          After your password you will be asked for a{' '}
          <strong className="font-semibold">6-digit code</strong>. Two-factor verification cannot be
          skipped on admin accounts.
        </InlineAlert>
      </form>
    </AuthShell>
  )
}
