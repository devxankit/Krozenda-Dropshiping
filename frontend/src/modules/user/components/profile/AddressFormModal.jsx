import React, { useState, useEffect } from 'react'
import { HiXMark } from 'react-icons/hi2'

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

  // Reset or seed form whenever modal opens or edited address changes
  useEffect(() => {
    if (open) {
      setForm(initialValues ? { ...EMPTY_FORM, ...initialValues } : { ...EMPTY_FORM })
      setError(null)
    }
  }, [open, initialValues?.id])

  if (!open) return null

  const update = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))

  const handleClose = () => {
    setForm({ ...EMPTY_FORM })
    setError(null)
    onClose?.()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (!form.fullName.trim() || !form.phone.trim() || !form.line1.trim() || !form.city.trim() || !form.state.trim() || !form.pincode.trim()) {
      setError('Please fill in all required fields')
      return
    }

    try {
      await onSubmit(form)
      setForm({ ...EMPTY_FORM })
      setError(null)
      onClose?.()
    } catch (err) {
      setError(err?.message || 'Could not save this address. Please try again.')
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
        <div className="sticky top-0 bg-white px-5 py-4 border-b border-slate-100 flex items-center justify-between">
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
            <Field label="Full Name" value={form.fullName} onChange={update('fullName')} required />
            <Field label="Phone Number" value={form.phone} onChange={update('phone')} required />
          </div>

          <Field label="Address Line 1" value={form.line1} onChange={update('line1')} required />
          <Field label="Address Line 2 (optional)" value={form.line2} onChange={update('line2')} />

          <div className="grid grid-cols-3 gap-3">
            <Field label="City" value={form.city} onChange={update('city')} required />
            <Field label="State" value={form.state} onChange={update('state')} required />
            <Field label="Pincode" value={form.pincode} onChange={update('pincode')} required />
          </div>

          <label className="flex items-center space-x-2 text-xs font-semibold text-slate-700">
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

function Field({ label, required, ...props }) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-bold text-slate-500">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      <input
        {...props}
        className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
      />
    </label>
  )
}
