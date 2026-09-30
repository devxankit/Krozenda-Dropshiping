import { useMemo, useState } from 'react'
import { Avatar, Badge, Button, Input, PasswordInput } from '../../../../components/ui'
import { PageBody, PageHeader } from '../../components/shell'
import { ErrorState, PageSkeleton } from '../../components/feedback'
import { SectionCard } from '../../components/display'
import { useAdminProfileController, useAdminProfileWriteController } from '../../controllers/useSystemController'

const joined = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : null

// The signed-in admin's own account: details and photo, and password.
export function AdminProfilePage() {
  const { data, isLoading, error, refetch } = useAdminProfileController()

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
  // Keyed on the saved values, so the form restarts from them after a save.
  return <ProfileBody key={`${data.name}|${data.email}|${data.mobileNumber}|${data.image}`} profile={data} />
}

function ProfileBody({ profile }) {
  const [form, setForm] = useState({ name: profile.name, email: profile.email, mobileNumber: profile.mobileNumber })
  const [photo, setPhoto] = useState(null)
  const photoUrl = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo])
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [passwordError, setPasswordError] = useState('')

  const write = useAdminProfileWriteController({
    onPasswordChanged: () => setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' }),
  })

  const detailsChanged =
    Boolean(photo) || form.name !== profile.name || form.email !== profile.email || form.mobileNumber !== profile.mobileNumber

  function saveDetails(event) {
    event.preventDefault()
    const body = new FormData()
    body.append('name', form.name.trim())
    body.append('email', form.email.trim())
    body.append('mobileNumber', form.mobileNumber.trim())
    if (photo) body.append('image', photo)
    write.update.run(body)
  }

  function savePassword(event) {
    event.preventDefault()
    if (passwords.newPassword.length < 6) return setPasswordError('The new password needs at least 6 characters.')
    if (passwords.newPassword !== passwords.confirmPassword) return setPasswordError('The two new passwords do not match.')
    setPasswordError('')
    write.changePassword.run(passwords)
  }

  const field = (key) => ({
    value: form[key],
    onChange: (e) => setForm((current) => ({ ...current, [key]: e.target.value })),
  })
  const passwordField = (key) => ({
    value: passwords[key],
    onChange: (e) => setPasswords((current) => ({ ...current, [key]: e.target.value })),
  })

  return (
    <PageBody>
      <PageHeader title="My profile" description="Your own account: how you appear in the panel, and your password." />

      <SectionCard title="Account">
        <form onSubmit={saveDetails} className="flex flex-col gap-5 p-4">
          <div className="flex flex-wrap items-center gap-4">
            <Avatar name={profile.name} src={photoUrl || profile.image || undefined} size="lg" tone="inverted" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">{profile.name || profile.email}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <Badge tone="brand" size="sm">{profile.roleName}</Badge>
                <span className="text-2xs text-ink-faint">{profile.permissionCount} permissions</span>
                {joined(profile.joinedAt) && <span className="text-2xs text-ink-faint">Joined {joined(profile.joinedAt)}</span>}
              </div>
            </div>
            <label className="cursor-pointer rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-xs ring-1 ring-slate-200 hover:bg-slate-50">
              {photo ? photo.name : 'Change photo'}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                aria-label="Profile photo"
                onChange={(e) => setPhoto(e.target.files?.[0] || null)}
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Input id="profile-name" label="Name" size="control" required {...field('name')} />
            <Input id="profile-email" label="Email" type="email" size="control" required {...field('email')} />
            <Input id="profile-mobile" label="Mobile" size="control" {...field('mobileNumber')} />
          </div>

          <div className="flex justify-end">
            <Button type="submit" size="control" disabled={!detailsChanged} isLoading={write.update.isSubmitting}>
              Save details
            </Button>
          </div>
        </form>
      </SectionCard>

      <SectionCard title="Password" description="You need your current password to set a new one.">
        <form onSubmit={savePassword} className="flex flex-col gap-4 p-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <PasswordInput id="current-password" label="Current password" size="control" autoComplete="current-password" {...passwordField('currentPassword')} />
            <PasswordInput id="new-password" label="New password" size="control" autoComplete="new-password" {...passwordField('newPassword')} />
            <PasswordInput id="confirm-password" label="Confirm new password" size="control" autoComplete="new-password" {...passwordField('confirmPassword')} />
          </div>
          {passwordError && <p className="text-xs text-danger-700" role="alert">{passwordError}</p>}
          <div className="flex justify-end">
            <Button
              type="submit"
              size="control"
              disabled={!passwords.currentPassword || !passwords.newPassword}
              isLoading={write.changePassword.isSubmitting}
            >
              Change password
            </Button>
          </div>
        </form>
      </SectionCard>
    </PageBody>
  )
}
