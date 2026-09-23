import React, { useState, useEffect } from 'react'
import { HiXMark } from 'react-icons/hi2'
import { toast } from '../../../../lib/toast'

const TYPES = [
  { id: 'home', label: 'Home' },
  { id: 'office', label: 'Office' },
  { id: 'other', label: 'Other' },
]

const EMPTY_FORM = {
  type: 'home',
  fullName: '',
  phone: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  pincode: '',
  isDefault: false,
}

// Shared by MyAddressesScreen (full CRUD) and SelectAddressScreen (checkout
// step 1's "Add New Address") so the form only exists once. Hand-rolled with
// plain Tailwind (not components/ui/Modal) — that kit is deliberately scoped
// to .admin-root and isn't meant to leak into the buyer app's own style.
export function AddressFormModal({ open, initialValues = null, onClose, onSubmit, isSubmitting = false }) {
  const [form, setForm] = useState(() => (initialValues ? { ...EMPTY_FORM, ...initialValues } : { ...EMPTY_FORM }))
  const [error, setError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})

  // Reset or seed form whenever modal opens or edited address changes
  useEffect(() => {
    if (open) {
      setForm(initialValues ? { ...EMPTY_FORM, ...initialValues } : { ...EMPTY_FORM })
      setError(null)
      setFieldErrors({})
    }
  }, [open, initialValues?.id])

  if (!open) return null

  const update = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }))
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  const handlePhoneChange = (e) => {
    let digits = e.target.value.replace(/\D/g, '')
    // Auto-normalize if pasted with +91 or leading 0
    if (digits.length > 10) {
      if (digits.startsWith('91') && digits.length === 12) {
        digits = digits.slice(2)
      } else if (digits.startsWith('0') && digits.length === 11) {
        digits = digits.slice(1)
      } else {
        digits = digits.slice(0, 10)
      }
    }
    setForm((prev) => ({ ...prev, phone: digits }))
    if (fieldErrors.phone) {
      setFieldErrors((prev) => ({ ...prev, phone: undefined }))
    }
  }

  const handlePhoneBlur = () => {
    const phone = form.phone.trim()
    if (!phone) {
      setFieldErrors((prev) => ({ ...prev, phone: 'Phone number is required' }))
    } else if (phone.length !== 10) {
      setFieldErrors((prev) => ({ ...prev, phone: 'Mobile number must be exactly 10 digits' }))
    } else if (!/^[6-9]\d{9}$/.test(phone)) {
      setFieldErrors((prev) => ({ ...prev, phone: 'Mobile number must start with 6, 7, 8, or 9' }))
    }
  }

  const handlePincodeChange = (e) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 6)
    setForm((prev) => ({ ...prev, pincode: digits }))
    if (fieldErrors.pincode) {
      setFieldErrors((prev) => ({ ...prev, pincode: undefined }))
    }
  }

  const handlePincodeBlur = () => {
    const pin = form.pincode.trim()
    if (!pin) {
      setFieldErrors((prev) => ({ ...prev, pincode: 'Pincode is required' }))
    } else if (pin.length !== 6) {
      setFieldErrors((prev) => ({ ...prev, pincode: 'Pincode must be exactly 6 digits' }))
    } else if (pin.startsWith('0')) {
      setFieldErrors((prev) => ({ ...prev, pincode: 'Pincode cannot start with 0' }))
    } else if (!/^[1-9]\d{5}$/.test(pin)) {
      setFieldErrors((prev) => ({ ...prev, pincode: 'Enter a valid 6-digit pincode' }))
    }
  }

  const handleClose = () => {
    setForm({ ...EMPTY_FORM })
    setError(null)
    setFieldErrors({})
    onClose?.()
  }

  const validate = () => {
    const errors = {}

    if (!form.fullName.trim()) {
      errors.fullName = 'Full name is required'
    }

    const phone = form.phone.trim()
    if (!phone) {
      errors.phone = 'Phone number is required'
    } else if (phone.length !== 10) {
      errors.phone = 'Mobile number must be exactly 10 digits'
    } else if (!/^[6-9]\d{9}$/.test(phone)) {
      errors.phone = 'Mobile number must start with 6, 7, 8, or 9'
    }

    if (!form.line1.trim()) {
      errors.line1 = 'Address line 1 is required'
    }

    if (!form.city.trim()) {
      errors.city = 'City is required'
    } else if (/^\d+$/.test(form.city.trim())) {
      errors.city = 'City cannot be only numbers'
    }

    if (!form.state.trim()) {
      errors.state = 'State is required'
    } else if (/^\d+$/.test(form.state.trim())) {
      errors.state = 'State cannot be only numbers'
    }

    const pincode = form.pincode.trim()
    if (!pincode) {
      errors.pincode = 'Pincode is required'
    } else if (pincode.length !== 6) {
      errors.pincode = 'Pincode must be exactly 6 digits'
    } else if (pincode.startsWith('0')) {
      errors.pincode = 'Pincode cannot start with 0'
    } else if (!/^[1-9]\d{5}$/.test(pincode)) {
      errors.pincode = 'Enter a valid 6-digit pincode'
    }

    return errors
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    const errors = validate()
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    try {
      await onSubmit({
        ...form,
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        line1: form.line1.trim(),
        line2: form.line2.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        pincode: form.pincode.trim(),
      })
      setForm({ ...EMPTY_FORM })
      setError(null)
      setFieldErrors({})
      onClose?.()
    } catch (err) {
      const msg = err?.message || 'Could not save this address. Please try again.'
      setError(msg)
      toast.error('Could not save address', err)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm p-0 sm:p-4"
      onClick={handleClose}
    >
      <div
        className="bg-white w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl max-h-[92vh] overflow-y-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white px-5 py-4 border-b border-slate-100 flex items-center justify-between z-10">
          <h2 className="text-sm font-black text-slate-900">
            {initialValues?.id ? 'Edit Address' : 'Add New Address'}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-full hover:bg-slate-100 text-slate-500"
          >
            <HiXMark className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="flex items-center space-x-2">
            {TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, type: t.id }))}
                className={`px-4 py-2 rounded-xl text-xs font-bold border transition-colors ${
                  form.type === t.id
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Full Name"
              value={form.fullName}
              onChange={update('fullName')}
              error={fieldErrors.fullName}
              placeholder="Recipient name"
              required
            />
            <Field
              label="Phone Number"
              type="tel"
              inputMode="numeric"
              maxLength={10}
              placeholder="10-digit mobile number"
              value={form.phone}
              onChange={handlePhoneChange}
              onBlur={handlePhoneBlur}
              error={fieldErrors.phone}
              required
            />
          </div>

          <Field
            label="Address Line 1"
            value={form.line1}
            onChange={update('line1')}
            error={fieldErrors.line1}
            placeholder="Flat, House no., Building, Apartment"
            required
          />
          <Field
            label="Address Line 2 (optional)"
            value={form.line2}
            onChange={update('line2')}
            placeholder="Area, Street, Sector, Village"
          />

          <div className="grid grid-cols-3 gap-3">
            <Field
              label="City"
              value={form.city}
              onChange={update('city')}
              error={fieldErrors.city}
              placeholder="City"
              required
            />
            <Field
              label="State"
              value={form.state}
              onChange={update('state')}
              error={fieldErrors.state}
              placeholder="State"
              required
            />
            <Field
              label="Pincode"
              type="tel"
              inputMode="numeric"
              maxLength={6}
              placeholder="6 digits"
              value={form.pincode}
              onChange={handlePincodeChange}
              onBlur={handlePincodeBlur}
              error={fieldErrors.pincode}
              required
            />
          </div>

          <label className="flex items-center space-x-2 text-xs font-semibold text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(e) => setForm((prev) => ({ ...prev, isDefault: e.target.checked }))}
              className="w-4 h-4 accent-blue-600 rounded"
            />
            <span>Set as default address</span>
          </label>

          {error && <p className="text-xs font-semibold text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold py-3 rounded-xl text-xs tracking-wide transition-colors"
          >
            {isSubmitting ? 'Saving...' : 'Save Address'}
          </button>
        </form>
      </div>
    </div>
  )
}

function Field({ label, required, error, ...props }) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-bold text-slate-500">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      <input
        {...props}
        className={`w-full px-3 py-2.5 bg-slate-50 border rounded-xl text-xs font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white transition-colors ${
          error
            ? 'border-red-400 focus:ring-2 focus:ring-red-500 bg-red-50/30'
            : 'border-slate-200 focus:ring-2 focus:ring-blue-500'
        }`}
      />
      {error && <p className="text-[10.5px] font-semibold text-red-600">{error}</p>}
    </label>
  )
}
