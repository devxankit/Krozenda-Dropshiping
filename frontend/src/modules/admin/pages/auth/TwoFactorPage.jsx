import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Button } from '../../../../components/ui'
import { ADMIN_ROUTES } from '../../../../config/routes'
import { AuthShell } from '../../components/auth/AuthShell'
import { OtpInput } from '../../components/auth/OtpInput'
import { InlineAlert } from '../../components/feedback'
import { useAdminTwoFactorController } from '../../controllers/useAdminAuthController'

const RESEND_SECONDS = 30

export function TwoFactorPage() {
  const { challenge, submit, isSubmitting, error, reset } = useAdminTwoFactorController()
  const [code, setCode] = useState('')
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS)

  useEffect(() => {
    if (secondsLeft <= 0) return undefined
    const timer = setTimeout(() => setSecondsLeft((value) => value - 1), 1000)
    return () => clearTimeout(timer)
  }, [secondsLeft])

  // Landing here without a challenge means the password step was skipped.
  if (!challenge) return <Navigate to={ADMIN_ROUTES.LOGIN} replace />

  function handleChange(next) {
    setCode(next)
    if (error) reset()
  }

  return (
    <AuthShell
      title="Enter your verification code"
      description={`We sent a 6-digit code to ${challenge.maskedDestination}. It expires in five minutes.`}
      aside={
        <Link
          to={ADMIN_ROUTES.LOGIN}
          className="text-xs font-medium text-brand-600 hover:text-brand-700"
        >
          Use a different account
        </Link>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          submit(code)
        }}
        noValidate
      >
        {error && (
          <InlineAlert tone="danger" title="Code rejected">
            {error.message}
          </InlineAlert>
        )}

        <OtpInput
          value={code}
          onChange={handleChange}
          disabled={isSubmitting}
          error={code.length > 0 && code.length < 6 ? 'The code is 6 digits' : undefined}
        />

        <Button type="submit" size="md" isLoading={isSubmitting} disabled={code.length !== 6}>
          Verify and sign in
        </Button>

        <div className="flex items-center justify-between text-xs">
          <span className="text-ink-subtle">Did not get the code?</span>
          {secondsLeft > 0 ? (
            <span className="tabular text-ink-faint">Resend in {secondsLeft}s</span>
          ) : (
            <button
              type="button"
              onClick={() => setSecondsLeft(RESEND_SECONDS)}
              className="font-medium text-brand-600 hover:text-brand-700"
            >
              Send it again
            </button>
          )}
        </div>

        <InlineAlert tone="info">
          Codes are delivered over SMS India Hub. If your number has changed, a Super Admin has to
          update it before you can sign in.
        </InlineAlert>
      </form>
    </AuthShell>
  )
}
