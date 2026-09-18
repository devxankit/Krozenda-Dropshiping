import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Input, PasswordInput, Select } from '../../../components/ui'
import { VendorAuthShell } from '../components/shell/VendorAuthShell'
import { useAuthStore } from '../../../lib/authStore'
import { toast } from '../../admin/stores/toastStore'
import { useVendorRegisterController, useVendorPushRegistration } from '../controllers/useVendorController'

// Mirrors the businessType enum on backend/Models/Vendor.js, in the same
// order, so a reviewer can diff the two at a glance. A value this list
// invented would be rejected by mongoose, not silently stored.
const BUSINESS_TYPES = [
  { value: 'proprietorship', label: 'Proprietorship' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'llp', label: 'LLP' },
  { value: 'private_limited', label: 'Private Limited' },
  { value: 'public_limited', label: 'Public Limited' },
  { value: 'huf', label: 'HUF' },
  { value: 'society_trust', label: 'Society / Trust' },
  { value: 'other', label: 'Other' },
]

const BLANK = {
  vendorType: 'B2C',
  name: '',
  email: '',
  mobile: '',
  password: '',
  confirmPassword: '',
  gstRegistered: 'false',
  businessName: '',
  businessType: '',
  tradeName: '',
  pan: '',
  gstin: '',
  udyamNumber: '',
  contactName: '',
  contactDesignation: '',
  contactMobile: '',
  contactEmail: '',
  addressLine: '',
  city: '',
  state: '',
  pincode: '',
  accountHolderName: '',
  bankName: '',
  accountNumber: '',
  ifsc: '',
}

// Deliberately mirrors createVendorAccount() in vendorAuthController.js
// rather than inventing its own rules. The server stays the authority — this
// exists so a seller finds out about a missing GSTIN on step 2 instead of
// after filling in three screens.
function validateStep(step, form) {
  const errors = {}
  const isB2B = form.vendorType === 'B2B'

  if (step === 1) {
    if (!form.name.trim()) errors.name = 'Required'
    if (!form.email.trim()) errors.email = 'Required'
    else if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) errors.email = 'Enter a valid email'
    if (!form.mobile.trim()) errors.mobile = 'Required'
    else if (!/^\d{10}$/.test(form.mobile.replace(/\D/g, ''))) errors.mobile = 'Enter a 10-digit mobile number'
    if (!form.password) errors.password = 'Required'
    else if (form.password.length < 6) errors.password = 'At least 6 characters'
    if (form.password !== form.confirmPassword) errors.confirmPassword = 'Passwords do not match'
  }

  if (step === 2) {
    if (isB2B) {
      if (!form.businessName.trim()) errors.businessName = 'Required for a registered business'
      if (!form.businessType) errors.businessType = 'Required for a registered business'
      if (!form.contactName.trim()) errors.contactName = 'Required for a registered business'
      if (!form.contactMobile.trim()) errors.contactMobile = 'Required for a registered business'
    }
    if (form.gstRegistered === 'true' && !form.gstin.trim()) {
      errors.gstin = 'GSTIN is required when GST registered is Yes'
    }
  }

  if (step === 3) {
    if (!form.addressLine.trim()) errors.addressLine = 'Required'
    if (!form.city.trim()) errors.city = 'Required'
    if (!form.state.trim()) errors.state = 'Required'
    if (!form.pincode.trim()) errors.pincode = 'Required'
    else if (!/^\d{6}$/.test(form.pincode.trim())) errors.pincode = 'Enter a 6-digit pincode'
    if (form.ifsc.trim() && !/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(form.ifsc.trim())) errors.ifsc = 'Enter a valid IFSC'
  }

  return errors
}

function toPayload(form) {
  return {
    vendorType: form.vendorType,
    name: form.name.trim(),
    email: form.email.trim(),
    mobile: form.mobile.trim(),
    password: form.password,
    confirmPassword: form.confirmPassword,
    gstRegistered: form.gstRegistered === 'true',
    business: {
      businessName: form.businessName.trim(),
      businessType: form.businessType || null,
      tradeName: form.tradeName.trim(),
      pan: form.pan.trim(),
      gstin: form.gstin.trim(),
      udyamNumber: form.udyamNumber.trim(),
    },
    contactPerson: {
      name: form.contactName.trim(),
      designation: form.contactDesignation.trim(),
      mobile: form.contactMobile.trim(),
      email: form.contactEmail.trim(),
    },
    address: {
      addressLine: form.addressLine.trim(),
      city: form.city.trim(),
      state: form.state.trim(),
      pincode: form.pincode.trim(),
      country: 'India',
    },
    bank: {
      accountHolderName: form.accountHolderName.trim(),
      bankName: form.bankName.trim(),
      accountNumber: form.accountNumber.trim(),
      ifsc: form.ifsc.trim().toUpperCase(),
    },
  }
}

const STEP_TITLES = ['Your account', 'Business details', 'Address and payout']

export function VendorRegisterPage() {
  const navigate = useNavigate()
  const { register, isSubmitting } = useVendorRegisterController()
  const registerPushToken = useVendorPushRegistration()
  const [step, setStep] = useState(1)
  const [form, setForm] = useState(BLANK)
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState(null)

  const isB2B = form.vendorType === 'B2B'
  const set = (key) => (e) => {
    const { value } = e.target
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev))
  }

  function goNext() {
    const found = validateStep(step, form)
    setErrors(found)
    if (Object.keys(found).length === 0) setStep(step + 1)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setServerError(null)

    const found = validateStep(3, form)
    setErrors(found)
    if (Object.keys(found).length > 0) return

    try {
      const { token, vendor } = await register(toPayload(form))

      // The same session shape the sign-in path writes, so a newly registered
      // seller lands in the panel already authenticated. The status gate in
      // VendorLayout decides how much of it they can use — permissions do not
      // encode verification state.
      useAuthStore.getState().setSession({
        user: {
          id: vendor.id,
          name: vendor.name,
          email: vendor.email,
          storeName: vendor.business?.businessName || vendor.name,
          entityType: vendor.vendorType === 'B2B' ? 'Registered Business' : 'Individual Seller',
          language: vendor.language ?? null,
        },
        roles: ['seller', vendor.vendorType === 'B2B' ? 'b2b_seller' : 'b2c_seller'],
        permissions: ['seller.access', 'vendor.access'],
        accessToken: token,
      })

      registerPushToken()
      toast.success('Account created', 'Upload your documents to finish verification.')
      navigate('/seller/kyc-documents')
    } catch (err) {
      const message = err?.response?.data?.message || 'Could not create your account'
      setServerError(message)
      toast.error('Registration failed', message)
    }
  }

  return (
    <VendorAuthShell
      title="Create your seller account"
      subtitle={`Step ${step} of 3 — ${STEP_TITLES[step - 1]}`}
      width="lg"
    >
      <div className="mt-6 flex items-center gap-2" aria-hidden="true">
        {[1, 2, 3].map((n) => (
          <div key={n} className={`h-1 flex-1 rounded-full ${n <= step ? 'bg-brand-500' : 'bg-slate-700'}`} />
        ))}
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        {step === 1 && (
          <>
            <fieldset>
              <legend className="mb-2 text-xs font-medium text-slate-300">I am selling as</legend>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: 'B2C', label: 'Individual', hint: 'No GST or company registration' },
                  { value: 'B2B', label: 'Registered business', hint: 'Company, LLP or firm' },
                ].map((option) => (
                  <button
                    type="button"
                    key={option.value}
                    onClick={() => setForm((prev) => ({ ...prev, vendorType: option.value }))}
                    aria-pressed={form.vendorType === option.value}
                    className={`rounded-xl border p-3 text-left transition ${
                      form.vendorType === option.value
                        ? 'border-brand-500 bg-brand-500/10'
                        : 'border-slate-700 bg-slate-800/40 hover:border-slate-600'
                    }`}
                  >
                    <span className="block text-sm font-semibold text-white">{option.label}</span>
                    <span className="mt-0.5 block text-2xs text-slate-400">{option.hint}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              <Input id="reg-name" label="Full name" value={form.name} onChange={set('name')} error={errors.name} required />
              <Input id="reg-mobile" label="Mobile number" value={form.mobile} onChange={set('mobile')} error={errors.mobile} required />
              <Input
                id="reg-email"
                type="email"
                label="Email address"
                value={form.email}
                onChange={set('email')}
                error={errors.email}
                required
                containerClassName="sm:col-span-2"
              />
              <PasswordInput id="reg-password" label="Password" value={form.password} onChange={set('password')} error={errors.password} required />
              <PasswordInput
                id="reg-confirm"
                label="Confirm password"
                value={form.confirmPassword}
                onChange={set('confirmPassword')}
                error={errors.confirmPassword}
                required
              />
            </div>
          </>
        )}

        {step === 2 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              id="reg-business-name"
              label="Store or business name"
              value={form.businessName}
              onChange={set('businessName')}
              error={errors.businessName}
              required={isB2B}
              containerClassName="sm:col-span-2"
            />
            <Select
              id="reg-business-type"
              label="Business type"
              options={BUSINESS_TYPES}
              placeholder="Select a type"
              value={form.businessType}
              onChange={set('businessType')}
              error={errors.businessType}
              required={isB2B}
            />
            <Input id="reg-trade-name" label="Trade name (optional)" value={form.tradeName} onChange={set('tradeName')} />
            <Input id="reg-pan" label="PAN (optional)" value={form.pan} onChange={set('pan')} />
            <Select
              id="reg-gst-registered"
              label="GST registered?"
              options={[
                { value: 'false', label: 'No' },
                { value: 'true', label: 'Yes' },
              ]}
              value={form.gstRegistered}
              onChange={set('gstRegistered')}
            />
            {form.gstRegistered === 'true' && (
              <Input
                id="reg-gstin"
                label="GSTIN"
                value={form.gstin}
                onChange={set('gstin')}
                error={errors.gstin}
                required
                containerClassName="sm:col-span-2"
              />
            )}
            <Input
              id="reg-udyam"
              label="Udyam number (optional)"
              value={form.udyamNumber}
              onChange={set('udyamNumber')}
              containerClassName="sm:col-span-2"
            />

            {isB2B && (
              <>
                <p className="sm:col-span-2 mt-2 text-xs font-medium text-slate-300">Authorised contact person</p>
                <Input id="reg-contact-name" label="Contact name" value={form.contactName} onChange={set('contactName')} error={errors.contactName} required />
                <Input
                  id="reg-contact-mobile"
                  label="Contact mobile"
                  value={form.contactMobile}
                  onChange={set('contactMobile')}
                  error={errors.contactMobile}
                  required
                />
                <Input id="reg-contact-designation" label="Designation (optional)" value={form.contactDesignation} onChange={set('contactDesignation')} />
                <Input id="reg-contact-email" type="email" label="Contact email (optional)" value={form.contactEmail} onChange={set('contactEmail')} />
              </>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <p className="sm:col-span-2 text-xs font-medium text-slate-300">
              Pickup address — couriers collect your parcels here.
            </p>
            <Input
              id="reg-address"
              label="Address line"
              value={form.addressLine}
              onChange={set('addressLine')}
              error={errors.addressLine}
              required
              containerClassName="sm:col-span-2"
            />
            <Input id="reg-city" label="City" value={form.city} onChange={set('city')} error={errors.city} required />
            <Input id="reg-state" label="State" value={form.state} onChange={set('state')} error={errors.state} required />
            <Input id="reg-pincode" label="Pincode" value={form.pincode} onChange={set('pincode')} error={errors.pincode} required />

            <p className="sm:col-span-2 mt-2 text-xs font-medium text-slate-300">
              Payout account — you can add this later from Settings.
            </p>
            <Input id="reg-account-holder" label="Account holder name" value={form.accountHolderName} onChange={set('accountHolderName')} />
            <Input id="reg-bank-name" label="Bank name" value={form.bankName} onChange={set('bankName')} />
            <Input id="reg-account-number" label="Account number" value={form.accountNumber} onChange={set('accountNumber')} />
            <Input id="reg-ifsc" label="IFSC" value={form.ifsc} onChange={set('ifsc')} error={errors.ifsc} />
          </div>
        )}

        {serverError && (
          <p role="alert" className="rounded-lg border border-danger-800 bg-danger-950/40 px-3 py-2 text-xs text-danger-300">
            {serverError}
          </p>
        )}

        <div className="flex items-center justify-between gap-3 pt-2">
          {step > 1 ? (
            <Button type="button" variant="secondary" onClick={() => setStep(step - 1)}>
              Back
            </Button>
          ) : (
            <span />
          )}

          {step < 3 ? (
            <Button type="button" onClick={goNext}>
              Continue
            </Button>
          ) : (
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating account…' : 'Create account'}
            </Button>
          )}
        </div>
      </form>

      <p className="mt-6 text-center text-xs text-slate-400">
        Already selling with us?{' '}
        <Link to="/seller/login" className="font-medium text-brand-400 hover:text-brand-300">
          Sign in
        </Link>
      </p>
    </VendorAuthShell>
  )
}
