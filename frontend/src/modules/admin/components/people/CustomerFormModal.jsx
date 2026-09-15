import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { FormDrawer } from '../forms/FormDrawer'

export function CustomerFormModal({ isOpen, ...props }) {
  if (!isOpen) return null
  return <CustomerFormModalBody {...props} />
}

function CustomerFormModalBody({ onClose, onSubmit, isSubmitting, error }) {
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm({
    defaultValues: { name: '', email: '', mobileNumber: '', dob: '', isActive: true },
  })

  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)

  function handleImageChange(event) {
    const file = event.target.files?.[0] || null
    setImageFile(file)
    setValue('image', file)
    setImagePreview(file ? URL.createObjectURL(file) : null)
  }

  return (
    <FormDrawer
      isOpen
      onClose={onClose}
      title="Add customer"
      description="Create a new customer account."
      submitLabel={isSubmitting ? 'Adding...' : 'Add customer'}
      submitTone="primary"
      isSubmitting={isSubmitting}
      error={error}
      onSubmit={handleSubmit((values) => onSubmit({ ...values, image: imageFile }))}
      width="md"
    >
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-800 mb-1.5">Profile photo</label>
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200 flex items-center justify-center">
              {imagePreview ? (
                <img src={imagePreview} alt="Preview" className="h-full w-full object-cover" />
              ) : (
                <span className="text-2xs text-slate-400">No photo</span>
              )}
            </div>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-slate-700 hover:file:bg-slate-200"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-800 mb-1.5">Name</label>
          <input
            type="text"
            {...register('name')}
            placeholder="e.g. Rohan Sharma"
            className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100 shadow-2xs"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-800 mb-1.5">Email</label>
          <input
            type="email"
            {...register('email', {
              pattern: { value: /^\S+@\S+\.\S+$/, message: 'Enter a valid email' },
            })}
            placeholder="e.g. rohan@example.com"
            className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100 shadow-2xs"
          />
          {errors.email && <p className="text-2xs text-rose-600 mt-1">{errors.email.message}</p>}
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-800 mb-1.5">
            Mobile number <span className="text-rose-500">*</span>
          </label>
          <input
            type="tel"
            {...register('mobileNumber', {
              required: 'Mobile number is required',
              pattern: { value: /^[0-9]{10}$/, message: 'Enter a valid 10-digit mobile number' },
            })}
            placeholder="e.g. 9876543210"
            className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100 shadow-2xs"
          />
          {errors.mobileNumber && (
            <p className="text-2xs text-rose-600 mt-1">{errors.mobileNumber.message}</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-800 mb-1.5">Date of birth</label>
          <input
            type="date"
            {...register('dob')}
            className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100 shadow-2xs"
          />
        </div>

        <div>
          <span className="block text-xs font-bold text-slate-800 mb-1.5">Status</span>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 cursor-pointer has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50/60">
              <input type="radio" value="true" {...register('isActive')} defaultChecked />
              <span className="text-xs font-semibold text-slate-900">Active</span>
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 cursor-pointer has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50/60">
              <input type="radio" value="false" {...register('isActive')} />
              <span className="text-xs font-semibold text-slate-900">Inactive</span>
            </label>
          </div>
        </div>
      </div>
    </FormDrawer>
  )
}
