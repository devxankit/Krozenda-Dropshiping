import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { HiArrowLeft, HiShieldCheck, HiArrowPath, HiBanknotes, HiPlus, HiXMark, HiCheckCircle, HiClock, HiXCircle } from 'react-icons/hi2'
import { WebHeader } from '../../../../components/layout/WebHeader'
import { Footer } from '../../../../components/layout/Footer'
import { USER_ROUTES } from '../../../../config/routes'
import { useReturnsController } from '../../controllers/useReturnsController'
import { toast } from '../../../../lib/toast'

const MAX_PHOTOS = 4

const RETURN_REASONS = [
  'Damaged Product received',
  'Defective / Not Working',
  'Wrong Item Delivered',
  'Missing Product Accessories',
  'Quality Not as Expected',
  'Other',
]

const STATUS_META = {
  PENDING: { label: 'Pending Review', color: 'bg-amber-50 text-amber-700 border-amber-200', Icon: HiClock },
  APPROVED: { label: 'Approved', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', Icon: HiCheckCircle },
  REJECTED: { label: 'Rejected', color: 'bg-red-50 text-red-700 border-red-200', Icon: HiXCircle },
}

export function ReturnReplacementScreen({ onBack, onContinue }) {
  // See the note on the other screens: a no-op default made both controls dead
  // once the router stopped passing callbacks.
  const navigateFallback = useNavigate()
  const handleBack = onBack || (() => navigateFallback(-1))
  const handleContinue = onContinue || (() => navigateFallback(USER_ROUTES.ORDERS))
  const { items, isLoading, submitReturnRequest, isSubmitting, error } = useReturnsController()

  const [selectedKey, setSelectedKey] = useState('')
  const [requestType, setRequestType] = useState('REPLACEMENT')
  const [selectedReason, setSelectedReason] = useState(RETURN_REASONS[0])
  const [photos, setPhotos] = useState([])
  const [submitted, setSubmitted] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (!selectedKey && items.length > 0) {
      setSelectedKey(`${items[0].orderId}:${items[0].productId}`)
    }
  }, [items, selectedKey])

  useEffect(() => {
    return () => {
      photos.forEach((photo) => URL.revokeObjectURL(photo.previewUrl))
    }
  }, [photos])

  const selectedItem = items.find((item) => `${item.orderId}:${item.productId}` === selectedKey)
  const lockedStatus = selectedItem?.existingRequest?.status === 'PENDING' || selectedItem?.existingRequest?.status === 'APPROVED'
    ? selectedItem.existingRequest.status
    : null

  const handlePickPhotos = (event) => {
    const files = Array.from(event.target.files ?? []).slice(0, MAX_PHOTOS - photos.length)
    const next = files.map((file) => ({ file, previewUrl: URL.createObjectURL(file) }))
    setPhotos((prev) => [...prev, ...next])
    event.target.value = ''
  }

  const handleRemovePhoto = (index) => {
    setPhotos((prev) => {
      URL.revokeObjectURL(prev[index].previewUrl)
      return prev.filter((_, i) => i !== index)
    })
  }

  const handleSubmit = async () => {
    if (!selectedItem || lockedStatus) return
    setSubmitted(false)
    try {
      const request = await submitReturnRequest({
        orderId: selectedItem.orderId,
        productId: selectedItem.productId,
        requestType,
        reason: selectedReason,
        photoFiles: photos.map((p) => p.file),
      })
      setPhotos([])
      setSubmitted(true)
      toast.success('Request Submitted', 'Your return or replacement claim has been submitted.')
      onContinue(request)
    } catch (err) {
      toast.error('Submission Failed', err)
    }
  }

  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col text-slate-800 font-sans">
      <div className="hidden md:block"><WebHeader /></div>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 md:py-8 space-y-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button onClick={handleBack} className="p-2 rounded-full hover:bg-slate-100 text-slate-700">
              <HiArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-slate-900">Request Return or Replacement</h1>
              <p className="text-xs text-slate-500 mt-0.5">Submit a hassle-free replacement or refund claim on a delivered order.</p>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="bg-white rounded-3xl border border-slate-200/80 p-10 text-center text-xs font-semibold text-slate-400">
            Loading your delivered orders...
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-10 text-center space-y-1">
            <p className="text-sm font-bold text-slate-700">No delivered orders yet</p>
            <p className="text-xs text-slate-500">Once an order is delivered, you can request a return or replacement here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              {/* Item Selector */}
              <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs space-y-3">
                <label className="text-xs font-bold text-slate-900 block">Select a delivered item</label>
                <select
                  value={selectedKey}
                  onChange={(e) => setSelectedKey(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                >
                  {items.map((item) => (
                    <option key={`${item.orderId}:${item.productId}`} value={`${item.orderId}:${item.productId}`}>
                      {item.name} — Order #{item.orderId.slice(-8).toUpperCase()}
                    </option>
                  ))}
                </select>

                {selectedItem && (
                  <div className="flex items-center space-x-4 pt-2">
                    <div className="w-16 h-16 bg-slate-50 rounded-2xl p-2 shrink-0 border border-slate-100 flex items-center justify-center">
                      <img src={selectedItem.image || '/images/placeholder.png'} alt={selectedItem.name} className="w-full h-full object-contain" />
                    </div>
                    <div>
                      <span className="text-sm font-black text-blue-700 block">₹{selectedItem.price.toLocaleString('en-IN')}</span>
                      <span className="text-[11px] text-slate-500">Qty {selectedItem.quantity}</span>
                    </div>
                  </div>
                )}

                {lockedStatus && (
                  <div className={`flex items-center space-x-2 px-3.5 py-2.5 rounded-xl border text-xs font-bold ${STATUS_META[lockedStatus].color}`}>
                    {React.createElement(STATUS_META[lockedStatus].Icon, { className: 'w-4 h-4' })}
                    <span>A {selectedItem.existingRequest.requestType.toLowerCase()} request for this item is {STATUS_META[lockedStatus].label.toLowerCase()}.</span>
                  </div>
                )}
              </div>

              {!lockedStatus && (
                <>
                  <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs space-y-4">
                    <h3 className="text-sm font-black text-slate-900 border-b border-slate-100 pb-3">1. Select Action Required</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div
                        onClick={() => setRequestType('REPLACEMENT')}
                        className={`p-5 rounded-2xl border cursor-pointer transition-all ${
                          requestType === 'REPLACEMENT' ? 'border-blue-600 bg-blue-50/40 ring-2 ring-blue-500/20 shadow-md' : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                            <HiArrowPath className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-slate-900">Replacement</h4>
                            <p className="text-xs text-slate-500">Get a replacement unit</p>
                          </div>
                        </div>
                      </div>

                      <div
                        onClick={() => setRequestType('REFUND')}
                        className={`p-5 rounded-2xl border cursor-pointer transition-all ${
                          requestType === 'REFUND' ? 'border-blue-600 bg-blue-50/40 ring-2 ring-blue-500/20 shadow-md' : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                            <HiBanknotes className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-slate-900">Full Refund</h4>
                            <p className="text-xs text-slate-500">Refund credited to Krozenda Wallet</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs space-y-4">
                    <h3 className="text-sm font-black text-slate-900 border-b border-slate-100 pb-3">2. Reason for Claim</h3>
                    <div className="space-y-2.5">
                      {RETURN_REASONS.map((reason) => {
                        const isSelected = selectedReason === reason
                        return (
                          <div
                            key={reason}
                            onClick={() => setSelectedReason(reason)}
                            className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                              isSelected ? 'border-blue-600 bg-blue-50/40 font-bold text-slate-900' : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <span className="text-xs">{reason}</span>
                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${isSelected ? 'border-blue-600 bg-blue-600' : 'border-slate-300'}`}>
                              {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs space-y-2.5">
                    <label className="block text-xs font-bold text-slate-900">
                      Add Photos <span className="text-slate-400 font-normal">({photos.length}/{MAX_PHOTOS})</span>
                    </label>
                    <div className="flex items-center space-x-3">
                      {photos.map((photo, index) => (
                        <div key={photo.previewUrl} className="w-14 h-14 bg-slate-50 border border-slate-200 rounded-xl overflow-hidden p-0.5 relative">
                          <img src={photo.previewUrl} alt={`Selected ${index + 1}`} className="w-full h-full object-contain" />
                          <button
                            type="button"
                            onClick={() => handleRemovePhoto(index)}
                            className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-slate-900/80 text-white flex items-center justify-center"
                          >
                            <HiXMark className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      {photos.length < MAX_PHOTOS && (
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="w-14 h-14 rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:border-blue-500 transition-colors"
                        >
                          <HiPlus className="w-6 h-6" />
                        </button>
                      )}
                      <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePickPhotos} />
                    </div>
                  </div>
                </>
              )}
            </div>

            {!lockedStatus && (
              <div className="lg:col-span-1">
                <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-md space-y-5 sticky top-24">
                  <h3 className="text-base font-black text-slate-900 border-b border-slate-100 pb-3">Claim Overview</h3>

                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-medium">Request Type:</span>
                      <span className="font-bold text-blue-700">{requestType === 'REFUND' ? 'Full Refund' : 'Replacement'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-medium">Claim Reason:</span>
                      <span className="font-bold text-slate-900">{selectedReason}</span>
                    </div>
                    {requestType === 'REFUND' && selectedItem && (
                      <div className="flex justify-between pt-2 border-t border-slate-100">
                        <span className="text-slate-500 font-medium">Refund Amount:</span>
                        <span className="font-bold text-emerald-600">₹{(selectedItem.price * selectedItem.quantity).toLocaleString('en-IN')}</span>
                      </div>
                    )}
                  </div>

                  <div className="bg-emerald-50 p-3.5 rounded-2xl border border-emerald-100 flex items-center space-x-2 text-[11px] font-semibold text-emerald-800">
                    <HiShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span>Protected by Krozenda Buyer Guarantee</span>
                  </div>

                  {error && <p className="text-xs font-semibold text-red-600">{error.message}</p>}
                  {submitted && (
                    <div className="flex items-center space-x-2 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-2.5">
                      <HiCheckCircle className="w-4 h-4" />
                      <span>Request submitted successfully</span>
                    </div>
                  )}

                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitting || !selectedItem}
                    className="w-full bg-blue-700 hover:bg-blue-800 disabled:opacity-60 active:scale-[0.98] text-white font-bold py-4 px-4 rounded-2xl shadow-lg shadow-blue-500/20 transition-all text-xs tracking-wide"
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit Return Claim →'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}
