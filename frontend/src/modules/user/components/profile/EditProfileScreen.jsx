import React, { useEffect, useRef, useState } from 'react'
import { HiArrowLeft, HiCamera, HiCheckCircle, HiLockClosed } from 'react-icons/hi2'
import { WebHeader } from '../../../../components/layout/WebHeader'
import { BottomNavbar } from '../../../../components/layout/BottomNavbar'
import { useProfileController } from '../../controllers/useProfileController'

const EMPTY_PASSWORD_FORM = { currentPassword: '', newPassword: '', confirmPassword: '' }

function toDateInputValue(dob) {
  if (!dob) return ''
  const d = new Date(dob)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

export function EditProfileScreen({ onBack = () => {} }) {
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
  const [seeded, setSeeded] = useState(false)
  const [savedMessage, setSavedMessage] = useState(false)
  const [passwordForm, setPasswordForm] = useState(EMPTY_PASSWORD_FORM)
  const [passwordSaved, setPasswordSaved] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (profile && !seeded) {
      setForm({
        name: profile.name || '',
        email: profile.email || '',
        dob: toDateInputValue(profile.dob),
        mobileNumber: profile.mobileNumber || '',
      })
      setSeeded(true)
    }
  }, [profile, seeded])

  const update = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))

  const handlePickImage = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    await uploadImage(file)
    e.target.value = ''
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSavedMessage(false)
    await updateProfile(form)
    setSavedMessage(true)
    setTimeout(() => setSavedMessage(false), 3000)
  }

  const updatePassword = (field) => (e) => setPasswordForm((prev) => ({ ...prev, [field]: e.target.value }))

  const handlePasswordSubmit = async (e) => {
    e.preventDefault()
    setPasswordSaved(false)
    await changePassword(passwordForm)
    setPasswordForm(EMPTY_PASSWORD_FORM)
    setPasswordSaved(true)
    setTimeout(() => setPasswordSaved(false), 3000)
  }

  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col text-slate-800 font-sans">
      <div className="hidden md:block"><WebHeader /></div>

      <main className="flex-1 pb-24 md:pb-12 max-w-2xl mx-auto w-full md:px-6 md:py-6">
        <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center space-x-3 shadow-xs">
          <button onClick={onBack} className="p-1.5 rounded-full hover:bg-slate-100 text-slate-700 transition-colors">
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
                    <img src={profile.image} alt={profile.name} className="w-full h-full object-cover" />
                  ) : (
                    (form.name || 'C').charAt(0).toUpperCase()
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingImage}
                  className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-md border-2 border-white transition-colors disabled:opacity-60"
                >
                  <HiCamera className="w-4 h-4" />
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePickImage} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">Profile Photo</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {isUploadingImage ? 'Uploading...' : 'Tap the camera icon to change your photo'}
                </p>
              </div>
            </div>

            {/* Fields */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
              <Field label="Full Name" value={form.name} onChange={update('name')} required />
              <Field label="Email Address" type="email" value={form.email} onChange={update('email')} />
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
                  Optional — set a password if you'd also like to sign in without OTP. Leave "Current Password" blank if you haven't set one yet.
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

      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50">
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
