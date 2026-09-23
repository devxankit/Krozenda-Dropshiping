import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { FormDrawer } from '../forms/FormDrawer'
import { api } from '../../../../lib/axios'
import { HiOutlineUser, HiOutlineBuildingStorefront, HiOutlineCheck, HiOutlineMagnifyingGlass, HiOutlineDevicePhoneMobile } from 'react-icons/hi2'

const AUDIENCE_OPTIONS = [
  { value: 'customers', label: 'All customers', description: 'Every buyer with push enabled' },
  { value: 'sellers', label: 'All sellers', description: 'Every seller with push & in-app notifications' },
  { value: 'both', label: 'Customers & sellers', description: 'Both audiences at once' },
  { value: 'specific_seller', label: 'Specific seller', description: 'Direct message/notification to an individual seller' },
]

export function CampaignFormModal({ isOpen, ...props }) {
  if (!isOpen) return null
  return <CampaignFormModalBody {...props} />
}

function CampaignFormModalBody({ onClose, onSubmit, isSubmitting, error }) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    defaultValues: { title: '', message: '', audience: 'customers', targetVendorId: '' },
  })

  const audience = watch('audience')
  const targetVendorId = watch('targetVendorId')

  const [vendors, setVendors] = useState([])
  const [loadingVendors, setLoadingVendors] = useState(false)
  const [vendorSearch, setVendorSearch] = useState('')
  const [selectedVendor, setSelectedVendor] = useState(null)
  const [vendorError, setVendorError] = useState(null)

  useEffect(() => {
    if (audience === 'specific_seller' && vendors.length === 0 && !loadingVendors) {
      setLoadingVendors(true)
      api
        .get('/admin/vendors')
        .then((res) => {
          const list = res.data?.data?.items || []
          setVendors(list)
        })
        .catch((err) => {
          console.error('Failed to fetch vendors for campaign:', err)
        })
        .finally(() => {
          setLoadingVendors(false)
        })
    }
  }, [audience, vendors.length, loadingVendors])

  function handleSelectVendor(v) {
    setSelectedVendor(v)
    setValue('targetVendorId', v.id || v._id)
    setVendorError(null)
  }

  function handleFormSubmit(values) {
    if (values.audience === 'specific_seller' && !values.targetVendorId) {
      setVendorError('Please select a seller to send the notification')
      return
    }
    setVendorError(null)
    onSubmit(values)
  }

  const filteredVendors = vendors.filter((v) => {
    if (!vendorSearch.trim()) return true
    const q = vendorSearch.toLowerCase()
    const name = (v.name || '').toLowerCase()
    const email = (v.email || '').toLowerCase()
    const store = (v.business?.businessName || '').toLowerCase()
    return name.includes(q) || email.includes(q) || store.includes(q)
  })

  return (
    <FormDrawer
      isOpen
      onClose={onClose}
      title="New Notification"
      description="Send instant notifications to customers or targeted sellers via in-app alerts and Firebase Cloud Messaging."
      submitLabel={isSubmitting ? 'Sending...' : 'Send now'}
      submitTone="primary"
      isSubmitting={isSubmitting}
      error={error}
      onSubmit={handleSubmit(handleFormSubmit)}
      width="lg"
    >
      <div className="space-y-5">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5">
              Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              {...register('title', { required: 'Title is required', maxLength: { value: 80, message: 'Keep it under 80 characters' } })}
              placeholder="e.g. Account Update / Important Notice"
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100 shadow-2xs"
              autoFocus
            />
            {errors.title && <p className="text-2xs text-rose-600 mt-1">{errors.title.message}</p>}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5">
              Message <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={4}
              {...register('message', { required: 'Message is required', maxLength: { value: 240, message: 'Keep it under 240 characters' } })}
              placeholder="Type your notification message here..."
              className="w-full rounded-xl border border-slate-300 bg-white p-3.5 text-xs leading-relaxed text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100 shadow-2xs resize-y min-h-[100px]"
            />
            {errors.message && <p className="text-2xs text-rose-600 mt-1">{errors.message.message}</p>}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-3">
          <span className="block text-xs font-bold text-slate-800">Target audience</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {AUDIENCE_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-all ${
                  audience === option.value
                    ? 'border-blue-500 bg-blue-50/70 shadow-2xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <input
                  type="radio"
                  value={option.value}
                  {...register('audience', { required: true })}
                  className="mt-0.5 text-blue-600"
                />
                <span className="flex-1">
                  <span className="block text-xs font-bold text-slate-900">{option.label}</span>
                  <span className="block text-2xs text-slate-500 leading-tight mt-0.5">{option.description}</span>
                </span>
              </label>
            ))}
          </div>

          {/* Specific Seller Selector */}
          {audience === 'specific_seller' && (
            <div className="mt-4 pt-4 border-t border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <HiOutlineBuildingStorefront className="w-4 h-4 text-blue-600" />
                  Select Target Seller <span className="text-rose-500">*</span>
                </span>
                {selectedVendor && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedVendor(null)
                      setValue('targetVendorId', '')
                    }}
                    className="text-2xs text-blue-600 font-semibold hover:underline"
                  >
                    Change seller
                  </button>
                )}
              </div>

              {selectedVendor ? (
                <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                      {(selectedVendor.business?.businessName || selectedVendor.name || 'S')[0].toUpperCase()}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">
                        {selectedVendor.business?.businessName || selectedVendor.name}
                      </h4>
                      <p className="text-2xs text-slate-600">
                        {selectedVendor.email} · {selectedVendor.mobile || 'No mobile'}
                      </p>
                      <span className="inline-block mt-0.5 text-3xs font-semibold uppercase px-1.5 py-0.2 rounded bg-white border border-slate-200 text-slate-600">
                        {selectedVendor.vendorType === 'B2B' ? 'B2B Business' : 'B2C Individual'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-emerald-700 text-2xs font-semibold">
                    <HiOutlineCheck className="w-4 h-4 text-emerald-600" />
                    Selected
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <HiOutlineMagnifyingGlass className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={vendorSearch}
                      onChange={(e) => setVendorSearch(e.target.value)}
                      placeholder="Search seller by name, store, or email..."
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:border-blue-600 focus:outline-none"
                    />
                  </div>

                  {loadingVendors ? (
                    <div className="py-4 text-center text-xs text-slate-500">Loading sellers list...</div>
                  ) : filteredVendors.length === 0 ? (
                    <div className="py-4 text-center text-xs text-slate-500">
                      {vendorSearch ? 'No matching sellers found.' : 'No sellers registered yet.'}
                    </div>
                  ) : (
                    <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
                      {filteredVendors.slice(0, 15).map((v) => (
                        <button
                          key={v.id || v._id}
                          type="button"
                          onClick={() => handleSelectVendor(v)}
                          className="w-full text-left p-2.5 hover:bg-slate-50 flex items-center justify-between transition-colors"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-2xs shrink-0">
                              {(v.business?.businessName || v.name || 'S')[0].toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-900 truncate">
                                {v.business?.businessName || v.name}
                              </p>
                              <p className="text-2xs text-slate-500 truncate">{v.email}</p>
                            </div>
                          </div>
                          <span className="text-2xs text-blue-600 font-semibold shrink-0 ml-2">Select</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {vendorError && <p className="text-2xs text-rose-600 font-medium">{vendorError}</p>}
            </div>
          )}
        </div>
      </div>
    </FormDrawer>
  )
}
