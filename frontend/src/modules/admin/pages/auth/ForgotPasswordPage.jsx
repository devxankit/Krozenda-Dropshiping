import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Button, Icon, Input } from '../../../../components/ui'
import { ADMIN_ROUTES } from '../../../../config/routes'
import { AuthShell } from '../../components/auth/AuthShell'
import { InlineAlert } from '../../components/feedback'
import { useForgotPasswordController } from '../../controllers/useAdminAuthController'
import { forgotPasswordSchema } from '../../schemas/authSchema'
import { zodResolver } from '../../lib/zodResolver'

export function ForgotPasswordPage() {
  const { submit, isSubmitting, isSent, error } = useForgotPasswordController()

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  })

  if (isSent) {
    return (
      <AuthShell
        title="Check your inbox"
        description={`If ${getValues('email')} belongs to a Krozenda staff account, a reset link is on its way. The link is valid for one hour and can be used once.`}
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 rounded-lg border border-success-200 bg-success-50 px-4 py-3.5">
            <Icon name="mail" className="h-4 w-4 shrink-0 text-success-700" />
            <p className="text-xs leading-relaxed text-success-700">
              Not there in a few minutes? Check spam, then ask a Super Admin to confirm the address
              on your account.
            </p>
          </div>
          <Link to={ADMIN_ROUTES.LOGIN}>
            <Button variant="secondary" size="md" icon="arrowLeft" className="w-full">
              Back to sign in
            </Button>
          </Link>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Reset your password"
      description="Enter the work email on your admin account and we will send you a link to set a new password."
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

        <Button type="submit" size="md" isLoading={isSubmitting}>
          Send reset link
        </Button>

        <Link
          to={ADMIN_ROUTES.LOGIN}
          className="text-center text-xs font-medium text-brand-600 hover:text-brand-700"
        >
          Back to sign in
        </Link>
      </form>
    </AuthShell>
  )
}
