import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { HiArrowLeft, HiCamera, HiCheckCircle, HiLockClosed } from 'react-icons/hi2'
import { WebHeader } from '../../../../components/layout/WebHeader'
import { BottomNavbar } from '../../../../components/layout/BottomNavbar'
import { SmartImage } from '../../../../components/ui/SmartImage'
import { usePageMeta } from '../../../../lib/usePageMeta'
import { useProfileController } from '../../controllers/useProfileController'

const EMPTY_PASSWORD_FORM = { currentPassword: '', newPassword: '', confirmPassword: '' }

// Mirrors the backend's multer limit and its accepted formats. Checked before
// the upload rather than after a slow failed request — and, on a phone, before
// several megabytes go up a mobile connection for nothing (§6, §104).
const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']
const NAME_MAX_LENGTH = 80

function toDateInputValue(dob) {
  if (!dob) return ''
  const d = new Date(dob)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

export function EditProfileScreen({ onBack }) {
  // Falls back to real navigation when no callback is supplied. The
  // router stopped passing one when every screen took ownership of its
  // own navigation; the previous `= () => {}` default silently turned
  // the back button into a no-op.
  const goBackFallback = useNavigate()
  const handleBack = onBack || (() => goBackFallback(-1))

  const {
    profile,
    isLoading,
    updateProfile,
    isUpdating,
    updateError,
    uploadImage,
    isUploadingImage,
    changePassword,
    isChangingPassword,
    changePasswordError,
  } = useProfileController()

  const [form, setForm] = useState({ name: '', email: '', dob: '', mobileNumber: '' })
  const [savedMessage, setSavedMessage] = useState(false)
  const [passwordForm, setPasswordForm] = useState(EMPTY_PASSWORD_FORM)
  const [passwordSaved, setPasswordSaved] = useState(false)
  const [imageError, setImageError] = useState(null)
  const fileInputRef = useRef(null)

  usePageMeta({ title: 'Edit Profile', noindex: true })

  // Seed the form from the profile once it arrives. A render-phase adjustment
  // rather than an effect, so the fields paint populated on their first render
  // instead of flashing empty.
  const [seededFor, setSeededFor] = useState(null)
  if (profile && seededFor !== profile.id) {
    setSeededFor(profile.id)
    setForm({
      name: profile.name || '',
      email: profile.email || '',
      dob: toDateInputValue(profile.dob),
      mobileNumber: profile.mobileNumber || '',
    })
  }

  const update = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))

  const handlePickImage = async (e) => {
    const file = e.target.files?.[0]
    // Always clear, including on the cancel path, or re-picking the same file
    // fires no change event.
    e.target.value = ''
    setImageError(null)

    if (!file) return // the user cancelled the picker — not an error

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setImageError('Please choose a JPEG, PNG, WebP, AVIF or GIF image.')
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImageError('That image is larger than 10MB. Please choose a smaller one.')
      return
    }

    try {
      await uploadImage(file)
    } catch (err) {
      setImageError(err?.message || 'Could not upload that photo. Please try again.')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isUpdating) return
    setSavedMessage(false)
    try {
      await updateProfile(form)
      // "Saved" is only shown once the server has actually accepted it. This
      // used to run unconditionally, so a rejected email ("already in use")
      // showed the error AND "Profile updated successfully" side by side.
      setSavedMessage(true)
      setTimeout(() => setSavedMessage(false), 3000)
    } catch {
      // updateError below carries the server's message.
    }
  }

  const updatePassword = (field) => (e) => setPasswordForm((prev) => ({ ...prev, [field]: e.target.value }))

  const handlePasswordSubmit = async (e) => {
    e.preventDefault()
    if (isChangingPassword) return
    setPasswordSaved(false)
    try {
      await changePassword(passwordForm)
      // Same reasoning, and the form is only cleared on success — clearing it
      // on failure made the buyer retype everything to see what went wrong.
      setPasswordForm(EMPTY_PASSWORD_FORM)
      setPasswordSaved(true)
      setTimeout(() => setPasswordSaved(false), 3000)
    } catch {
      // changePasswordError below carries the server's message.
    }
  }

  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col text-slate-800 font-sans">
      <div className="hidden md:block"><WebHeader /></div>

      <main className="flex-1 pb-24 md:pb-12 max-w-2xl mx-auto w-full md:px-6 md:py-6">
        <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center space-x-3 shadow-xs">
          <button
            type="button"
            onClick={handleBack}
            aria-label="Go back"
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-700 transition-colors hover:bg-slate-100"
          >
            <HiArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-base font-bold text-slate-900">Edit Profile</h2>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-xs font-semibold text-slate-400">Loading your profile...</div>
        ) : (
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            {/* Profile photo */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex items-center space-x-4">
              <div className="relative shrink-0">
                <div className="w-20 h-20 rounded-full bg-blue-900 text-white font-black text-2xl flex items-center justify-center overflow-hidden border-4 border-white shadow-md">
                  {profile?.image ? (
                    <SmartImage
                      src={profile.image}
                      alt={`${profile.name || 'Your'} profile photo`}
                      sizes="80px"
                      ratio="1 / 1"
                      fit="cover"
                      className="h-full w-full"
                    />
                  ) : (
                    (form.name || 'C').charAt(0).toUpperCase()
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingImage}
                  aria-label="Change profile photo"
                  className="absolute -bottom-1 -right-1 flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-blue-600 text-white shadow-md transition-colors hover:bg-blue-700 disabled:opacity-60"
                >
                  <HiCamera className="w-4 h-4" aria-hidden="true" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  // Explicit MIME list rather than image/*: on Android a bare
                  // image/* picker happily returns HEIC, which the server
                  // cannot process. No `capture` attribute — forcing the camera
                  // would stop anyone choosing an existing photo (§105).
                  accept={ACCEPTED_IMAGE_TYPES.join(',')}
                  className="hidden"
                  onChange={handlePickImage}
                />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">Profile Photo</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {isUploadingImage ? 'Uploading…' : 'JPEG, PNG or WebP, up to 10MB'}
                </p>
                {imageError && (
                  <p role="alert" className="mt-1 text-[11px] font-semibold text-red-600">
                    {imageError}
                  </p>
                )}
              </div>
            </div>

            {/* Fields */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
              <Field
                label="Full Name"
                value={form.name}
                onChange={update('name')}
                required
                // Capped so an accidental paste of a paragraph is refused by
                // the field rather than by the server.
                maxLength={NAME_MAX_LENGTH}
                autoComplete="name"
              />
              <Field
                label="Email Address"
                type="email"
                value={form.email}
                onChange={update('email')}
                // type + inputMode + autoComplete together are what make the
                // WebView show an email keyboard and offer the saved address.
                inputMode="email"
                autoComplete="email"
              />
              <Field label="Date of Birth" type="date" value={form.dob} onChange={update('dob')} />
              <Field
                label="Mobile Number"
                value={form.mobileNumber}
                readOnly
                disabled
                helperText="Mobile number cannot be changed as it is linked to your account login."
              />
            </div>

            {updateError && (
              <p className="text-xs font-semibold text-red-600 px-1">{updateError.message}</p>
            )}
            {savedMessage && (
              <div className="flex items-center space-x-2 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-2.5">
                <HiCheckCircle className="w-4 h-4" />
                <span>Profile updated successfully</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isUpdating}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 active:scale-[0.98] text-white font-bold py-3.5 px-4 rounded-xl shadow-md transition-all text-xs tracking-wide"
            >
              {isUpdating ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        )}

        {!isLoading && (
          <form onSubmit={handlePasswordSubmit} className="p-4 pt-0 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
              <div>
                <p className="text-xs font-bold text-slate-900">Password</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Optional — set a password if you{'\u2019'}d also like to sign in without OTP.
                  Leave {'\u201C'}Current password{'\u201D'} blank if you have not set one yet.
                </p>
              </div>

              <Field
                label="Current Password"
                type="password"
                value={passwordForm.currentPassword}
                onChange={updatePassword('currentPassword')}
                autoComplete="current-password"
              />
              <Field
                label="New Password"
                type="password"
                value={passwordForm.newPassword}
                onChange={updatePassword('newPassword')}
                autoComplete="new-password"
                required
              />
              <Field
                label="Confirm New Password"
                type="password"
                value={passwordForm.confirmPassword}
                onChange={updatePassword('confirmPassword')}
                autoComplete="new-password"
                required
              />
            </div>

            {changePasswordError && (
              <p className="text-xs font-semibold text-red-600 px-1">{changePasswordError.message}</p>
            )}
            {passwordSaved && (
              <div className="flex items-center space-x-2 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-2.5">
                <HiCheckCircle className="w-4 h-4" />
                <span>Password updated successfully</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isChangingPassword || !passwordForm.newPassword}
              className="w-full bg-white hover:bg-slate-50 disabled:opacity-60 active:scale-[0.98] text-blue-700 border-2 border-blue-700 font-bold py-3.5 px-4 rounded-xl shadow-xs transition-all text-xs tracking-wide"
            >
              {isChangingPassword ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        )}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-50 md:hidden">
        <BottomNavbar activeTab="profile" />
      </div>
    </div>
  )
}

function Field({ label, required, readOnly, disabled, helperText, ...props }) {
  const isLocked = Boolean(readOnly || disabled)
  return (
    <label className="block space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-slate-500">
          {label} {required && !isLocked && <span className="text-red-500">*</span>}
        </span>
        {isLocked && (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400">
            <HiLockClosed className="w-3 h-3 text-slate-400" />
            Not Editable
          </span>
        )}
      </div>
      <input
        {...props}
        readOnly={readOnly}
        disabled={disabled}
        className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
          isLocked
            ? 'bg-slate-100 text-slate-500 border border-slate-200 cursor-not-allowed select-none focus:outline-none focus:ring-0 disabled:opacity-100 disabled:cursor-not-allowed'
            : 'bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white'
        }`}
      />
      {helperText && (
        <p className="text-[10px] text-slate-400 font-medium px-0.5">{helperText}</p>
      )}
    </label>
  )
}
