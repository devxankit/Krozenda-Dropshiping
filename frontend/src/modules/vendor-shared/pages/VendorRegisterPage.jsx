import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  HiOutlineCheck,
  HiOutlineArrowRight,
  HiOutlineArrowLeft,
  HiEye,
  HiEyeSlash,
  HiOutlineDocumentArrowUp,
  HiOutlineTrash,
  HiOutlineShieldCheck,
  HiOutlineDocumentCheck,
} from 'react-icons/hi2'
import { VendorAuthShell } from '../components/shell/VendorAuthShell'
import { toast } from '../../admin/stores/toastStore'
import { useVendorRegisterController } from '../controllers/useVendorController'
import { uploadRegistrationDocument } from '../services/authService'

const BUSINESS_TYPES = [
  { value: 'proprietorship', label: 'Proprietorship' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'llp', label: 'LLP (Limited Liability Partnership)' },
  { value: 'private_limited', label: 'Private Limited Company' },
  { value: 'public_limited', label: 'Public Limited Company' },
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

function validateStep(step, form, docs) {
  const errors = {}
  const isB2B = form.vendorType === 'B2B'

  if (step === 1) {
    if (!form.name.trim()) errors.name = 'Full name is required'
    if (!form.email.trim()) errors.email = 'Email address is required'
    else if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) errors.email = 'Enter a valid email'
    if (!form.mobile.trim()) errors.mobile = 'Mobile number is required'
    else if (!/^\d{10}$/.test(form.mobile.replace(/\D/g, ''))) errors.mobile = 'Enter a 10-digit mobile number'
    if (!form.password) errors.password = 'Password is required'
    else if (form.password.length < 6) errors.password = 'Must be at least 6 characters'
    if (form.password !== form.confirmPassword) errors.confirmPassword = 'Passwords do not match'
  }

  if (step === 2) {
    if (isB2B) {
      if (!form.businessName.trim()) errors.businessName = 'Business name is required'
      if (!form.businessType) errors.businessType = 'Please select a business type'
      if (!form.contactName.trim()) errors.contactName = 'Authorised contact name is required'
      if (!form.contactMobile.trim()) errors.contactMobile = 'Contact mobile is required'
    } else {
      if (!form.businessName.trim()) errors.businessName = 'Store / display name is required'
    }
    if (form.gstRegistered === 'true' && !form.gstin.trim()) {
      errors.gstin = 'GSTIN is required when registered'
    }
    if (!docs.panDoc?.url) {
      errors.panDoc = 'Please upload your PAN card document'
    }
    if (form.gstRegistered === 'true' && !docs.gstDoc?.url) {
      errors.gstDoc = 'Please upload your GST registration certificate'
    }
  }

  if (step === 3) {
    if (!form.addressLine.trim()) errors.addressLine = 'Address line is required'
    if (!form.city.trim()) errors.city = 'City is required'
    if (!form.state.trim()) errors.state = 'State is required'
    if (!form.pincode.trim()) errors.pincode = 'Pincode is required'
    else if (!/^\d{6}$/.test(form.pincode.trim())) errors.pincode = 'Enter a valid 6-digit pincode'
    if (form.ifsc.trim() && !/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(form.ifsc.trim())) {
      errors.ifsc = 'Enter a valid 11-digit IFSC (e.g. HDFC0001234)'
    }
  }

  return errors
}

const STEPS = [
  { num: 1, label: 'Account' },
  { num: 2, label: 'Business & Docs' },
  { num: 3, label: 'Pickup & Payout' },
]

export function VendorRegisterPage() {
  const navigate = useNavigate()
  const { register, isSubmitting } = useVendorRegisterController()
  const [step, setStep] = useState(1)
  const [form, setForm] = useState(BLANK)
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  // Direct Document Upload states
  const [docs, setDocs] = useState({
    panDoc: null, // { url, filename, originalname, uploading }
    gstDoc: null,
  })

  const isB2B = form.vendorType === 'B2B'
  const set = (key) => (e) => {
    const { value } = e.target
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev))
  }

  async function handleFileUpload(field, file) {
    if (!file) return
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    if (!allowed.includes(file.type)) {
      setErrors((prev) => ({ ...prev, [field]: 'Only JPG, PNG, WebP or PDF files are allowed' }))
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrors((prev) => ({ ...prev, [field]: 'File size must be under 10MB' }))
      return
    }

    try {
      setDocs((prev) => ({
        ...prev,
        [field]: { uploading: true, originalname: file.name },
      }))
      setErrors((prev) => ({ ...prev, [field]: undefined }))

      const res = await uploadRegistrationDocument(file)

      setDocs((prev) => ({
        ...prev,
        [field]: {
          url: res.url,
          filename: res.filename,
          originalname: file.name,
          uploading: false,
        },
      }))
      toast.success('Document uploaded', `${file.name} ready for verification.`)
    } catch (err) {
      setDocs((prev) => ({ ...prev, [field]: null }))
      setErrors((prev) => ({
        ...prev,
        [field]: err?.response?.data?.message || 'Upload failed. Please try another file.',
      }))
      toast.error('Upload failed', 'Could not upload document')
    }
  }

  function goNext() {
    const found = validateStep(step, form, docs)
    setErrors(found)
    if (Object.keys(found).length === 0) {
      setStep(step + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setServerError(null)

    const found = validateStep(3, form, docs)
    setErrors(found)
    if (Object.keys(found).length > 0) return

    // Prepare documents payload
    const documents = []
    if (docs.panDoc?.url) {
      documents.push({
        documentType: 'PAN_CARD',
        documentLabel: 'PAN Card Document',
        documentNumber: form.pan.trim(),
        documentUrl: docs.panDoc.url,
      })
    }
    if (docs.gstDoc?.url) {
      documents.push({
        documentType: 'GST_CERTIFICATE',
        documentLabel: 'GST Registration Certificate',
        documentNumber: form.gstin.trim(),
        documentUrl: docs.gstDoc.url,
      })
    }

    const payload = {
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
        pan: form.pan.trim().toUpperCase(),
        gstin: form.gstin.trim().toUpperCase(),
        udyamNumber: '',
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
      documents,
    }

    try {
      await register(payload)
      toast.success('Registration submitted', 'Your application is under review by admin.')
      setIsSubmitted(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      const message = err?.response?.data?.message || 'Could not create your account'
      setServerError(message)
      toast.error('Registration failed', message)
    }
  }

  // ================= SUBMISSION SUCCESS / APPROVAL PENDING VIEW =================
  if (isSubmitted) {
    return (
      <VendorAuthShell
        title="Application Submitted"
        subtitle="Your registration is under review by Krozenda Admin"
        width="sm"
      >
        <div className="text-center py-3 space-y-4">
          <div className="w-14 h-14 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-full flex items-center justify-center mx-auto shadow-xs">
            <HiOutlineShieldCheck className="w-8 h-8" />
          </div>

          <div>
            <h2 className="text-base font-bold text-slate-900">Registration Received!</h2>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed max-w-sm mx-auto">
              Your details and verification documents (PAN & GST) have been submitted to Admin. Once approved, you will be able to log in to your dashboard.
            </p>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200/90 rounded-2xl text-left space-y-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Applicant Name:</span>
              <span className="font-semibold text-slate-900">{form.name}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Registered Email:</span>
              <span className="font-semibold text-slate-900">{form.email}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Store / Business:</span>
              <span className="font-semibold text-slate-900">{form.businessName || 'Individual Seller'}</span>
            </div>
            <div className="flex justify-between text-slate-600 items-center pt-1 border-t border-slate-200/60">
              <span>Account Status:</span>
              <span className="font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md text-[11px]">
                Pending Admin Approval
              </span>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 pt-1">
            Our compliance team usually reviews and approves accounts within 24 business hours.
          </p>

          <button
            onClick={() => navigate('/seller/login')}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-xs transition-colors text-xs"
          >
            Go to Seller Login
          </button>
        </div>
      </VendorAuthShell>
    )
  }

  return (
    <VendorAuthShell
      title="Create Seller Account"
      subtitle="Register your store and upload your PAN/GST documents for approval"
      width="lg"
    >
      {/* Clean Minimal Stepper */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          {STEPS.map((s, idx) => {
            const isDone = step > s.num
            const isCurrent = step === s.num
            return (
              <div key={s.num} className="flex-1 flex items-center">
                <div className="flex items-center space-x-2">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                      isDone
                        ? 'bg-emerald-600 text-white'
                        : isCurrent
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-500 border border-slate-200'
                    }`}
                  >
                    {isDone ? <HiOutlineCheck className="w-4 h-4" /> : s.num}
                  </div>
                  <span
                    className={`text-xs font-semibold hidden sm:inline ${
                      isCurrent ? 'text-slate-900 font-bold' : isDone ? 'text-slate-700' : 'text-slate-400'
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
                {idx < STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-2 sm:mx-4 ${
                      step > s.num ? 'bg-emerald-500' : 'bg-slate-200'
                    }`}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* ================= STEP 1: ACCOUNT ================= */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                I am selling as <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  {
                    value: 'B2C',
                    title: 'Individual Seller (B2C)',
                    tag: 'No GST Required',
                    desc: 'For individual sellers, creators & small retail suppliers.',
                  },
                  {
                    value: 'B2B',
                    title: 'Registered Business (B2B)',
                    tag: 'GST & ITC Ready',
                    desc: 'For Proprietorship, LLP, or Pvt Ltd companies.',
                  },
                ].map((opt) => {
                  const isSelected = form.vendorType === opt.value
                  return (
                    <button
                      type="button"
                      key={opt.value}
                      onClick={() => setForm((prev) => ({ ...prev, vendorType: opt.value }))}
                      className={`p-3.5 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/50 ring-1 ring-blue-600 text-slate-900 shadow-xs'
                          : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold">{opt.title}</span>
                        <span
                          className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                            isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {opt.tag}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500 leading-snug">{opt.desc}</p>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={set('name')}
                  placeholder="e.g. Rahul Sharma"
                  required
                  className={`w-full bg-white border ${
                    errors.name ? 'border-red-500' : 'border-slate-300 hover:border-slate-400'
                  } focus:border-blue-600 focus:ring-4 focus:ring-blue-50 text-slate-900 rounded-xl px-3.5 py-2 text-xs outline-none font-medium`}
                />
                {errors.name && <p className="mt-1 text-[11px] text-red-500">{errors.name}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mobile Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  maxLength={10}
                  value={form.mobile}
                  onChange={set('mobile')}
                  placeholder="10-digit mobile number"
                  required
                  className={`w-full bg-white border ${
                    errors.mobile ? 'border-red-500' : 'border-slate-300 hover:border-slate-400'
                  } focus:border-blue-600 focus:ring-4 focus:ring-blue-50 text-slate-900 rounded-xl px-3.5 py-2 text-xs outline-none font-medium`}
                />
                {errors.mobile && <p className="mt-1 text-[11px] text-red-500">{errors.mobile}</p>}
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={set('email')}
                  placeholder="seller@example.com"
                  required
                  className={`w-full bg-white border ${
                    errors.email ? 'border-red-500' : 'border-slate-300 hover:border-slate-400'
                  } focus:border-blue-600 focus:ring-4 focus:ring-blue-50 text-slate-900 rounded-xl px-3.5 py-2 text-xs outline-none font-medium`}
                />
                {errors.email && <p className="mt-1 text-[11px] text-red-500">{errors.email}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Password <span className="text-red-500">*</span>
                </label>
                <div className="relative flex items-center">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={set('password')}
                    placeholder="Min 6 characters"
                    required
                    className={`w-full bg-white border ${
                      errors.password ? 'border-red-500' : 'border-slate-300 hover:border-slate-400'
                    } focus:border-blue-600 focus:ring-4 focus:ring-blue-50 text-slate-900 rounded-xl pl-3.5 pr-10 py-2 text-xs outline-none font-medium`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <HiEyeSlash className="w-4 h-4" /> : <HiEye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && <p className="mt-1 text-[11px] text-red-500">{errors.password}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Confirm Password <span className="text-red-500">*</span>
                </label>
                <div className="relative flex items-center">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={form.confirmPassword}
                    onChange={set('confirmPassword')}
                    placeholder="Re-enter password"
                    required
                    className={`w-full bg-white border ${
                      errors.confirmPassword ? 'border-red-500' : 'border-slate-300 hover:border-slate-400'
                    } focus:border-blue-600 focus:ring-4 focus:ring-blue-50 text-slate-900 rounded-xl pl-3.5 pr-10 py-2 text-xs outline-none font-medium`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 text-slate-400 hover:text-slate-600"
                  >
                    {showConfirmPassword ? <HiEyeSlash className="w-4 h-4" /> : <HiEye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.confirmPassword && <p className="mt-1 text-[11px] text-red-500">{errors.confirmPassword}</p>}
              </div>
            </div>
          </div>
        )}

        {/* ================= STEP 2: BUSINESS & DOCUMENTS ================= */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Store / Business Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.businessName}
                  onChange={set('businessName')}
                  placeholder="e.g. Apex Wholesale Supplies"
                  required={isB2B}
                  className={`w-full bg-white border ${
                    errors.businessName ? 'border-red-500' : 'border-slate-300 hover:border-slate-400'
                  } focus:border-blue-600 focus:ring-4 focus:ring-blue-50 text-slate-900 rounded-xl px-3.5 py-2 text-xs outline-none font-medium`}
                />
                {errors.businessName && <p className="mt-1 text-[11px] text-red-500">{errors.businessName}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Business Structure {isB2B && <span className="text-red-500">*</span>}
                </label>
                <select
                  value={form.businessType}
                  onChange={set('businessType')}
                  required={isB2B}
                  className={`w-full bg-white border ${
                    errors.businessType ? 'border-red-500' : 'border-slate-300 hover:border-slate-400'
                  } focus:border-blue-600 focus:ring-4 focus:ring-blue-50 text-slate-900 rounded-xl px-3.5 py-2 text-xs outline-none font-medium`}
                >
                  <option value="">Select constitution type…</option>
                  {BUSINESS_TYPES.map((bt) => (
                    <option key={bt.value} value={bt.value}>
                      {bt.label}
                    </option>
                  ))}
                </select>
                {errors.businessType && <p className="mt-1 text-[11px] text-red-500">{errors.businessType}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  PAN (Permanent Account Number) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  maxLength={10}
                  value={form.pan}
                  onChange={(e) => setForm((p) => ({ ...p, pan: e.target.value.toUpperCase() }))}
                  placeholder="ABCDE1234F"
                  className="w-full bg-white border border-slate-300 hover:border-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-50 text-slate-900 rounded-xl px-3.5 py-2 text-xs outline-none font-mono uppercase font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  GST Registered? <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.gstRegistered}
                  onChange={set('gstRegistered')}
                  className="w-full bg-white border border-slate-300 hover:border-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-50 text-slate-900 rounded-xl px-3.5 py-2 text-xs outline-none font-medium"
                >
                  <option value="false">No (Unregistered / Below 40L)</option>
                  <option value="true">Yes (Registered)</option>
                </select>
              </div>

              {form.gstRegistered === 'true' && (
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    15-Digit GSTIN <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    maxLength={15}
                    value={form.gstin}
                    onChange={(e) => setForm((p) => ({ ...p, gstin: e.target.value.toUpperCase() }))}
                    placeholder="27AAPFU0939F1ZV"
                    required
                    className={`w-full bg-white border ${
                      errors.gstin ? 'border-red-500' : 'border-slate-300 hover:border-slate-400'
                    } focus:border-blue-600 focus:ring-4 focus:ring-blue-50 text-slate-900 rounded-xl px-3.5 py-2 text-xs outline-none font-mono font-bold uppercase`}
                  />
                  {errors.gstin && <p className="mt-1 text-[11px] text-red-500">{errors.gstin}</p>}
                </div>
              )}
            </div>

            {/* DIRECT DOCUMENT UPLOAD SECTION */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3.5 mt-2">
              <div>
                <span className="text-xs font-bold text-slate-900 block flex items-center space-x-1.5">
                  <HiOutlineDocumentCheck className="w-4 h-4 text-blue-600" />
                  <span>Upload KYC Documents</span>
                </span>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Attach your documents directly. Formats accepted: PDF, JPG, PNG (Max 10MB each).
                </p>
              </div>

              {/* Upload 1: PAN Card Document */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  1. PAN Card Document <span className="text-red-500">*</span>
                </label>
                {docs.panDoc?.url ? (
                  <div className="flex items-center justify-between p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs">
                    <div className="flex items-center space-x-2 text-emerald-800">
                      <HiOutlineCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="font-semibold truncate max-w-xs">{docs.panDoc.originalname}</span>
                      <span className="text-[10px] text-emerald-600 font-bold uppercase">(Uploaded ✓)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDocs((p) => ({ ...p, panDoc: null }))}
                      className="text-slate-400 hover:text-red-600 p-1"
                      title="Remove file"
                    >
                      <HiOutlineTrash className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center justify-center space-x-2 border-2 border-dashed border-slate-300 hover:border-blue-500 bg-white p-3 rounded-xl cursor-pointer transition-colors group">
                    <HiOutlineDocumentArrowUp className="w-5 h-5 text-slate-400 group-hover:text-blue-600" />
                    <span className="text-xs font-semibold text-slate-600 group-hover:text-blue-600">
                      {docs.panDoc?.uploading ? 'Uploading PAN document…' : 'Choose PAN Card (Image or PDF)'}
                    </span>
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp,.pdf"
                      onChange={(e) => handleFileUpload('panDoc', e.target.files?.[0])}
                      className="hidden"
                      disabled={docs.panDoc?.uploading}
                    />
                  </label>
                )}
                {errors.panDoc && <p className="mt-1 text-[11px] text-red-500 font-medium">{errors.panDoc}</p>}
              </div>

              {/* Upload 2: GST Certificate Document */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  2. GST Certificate {form.gstRegistered === 'true' && <span className="text-red-500">*</span>}
                  {form.gstRegistered !== 'true' && <span className="text-slate-400 font-normal"> (Optional for unregistered)</span>}
                </label>
                {docs.gstDoc?.url ? (
                  <div className="flex items-center justify-between p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs">
                    <div className="flex items-center space-x-2 text-emerald-800">
                      <HiOutlineCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="font-semibold truncate max-w-xs">{docs.gstDoc.originalname}</span>
                      <span className="text-[10px] text-emerald-600 font-bold uppercase">(Uploaded ✓)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDocs((p) => ({ ...p, gstDoc: null }))}
                      className="text-slate-400 hover:text-red-600 p-1"
                      title="Remove file"
                    >
                      <HiOutlineTrash className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center justify-center space-x-2 border-2 border-dashed border-slate-300 hover:border-blue-500 bg-white p-3 rounded-xl cursor-pointer transition-colors group">
                    <HiOutlineDocumentArrowUp className="w-5 h-5 text-slate-400 group-hover:text-blue-600" />
                    <span className="text-xs font-semibold text-slate-600 group-hover:text-blue-600">
                      {docs.gstDoc?.uploading ? 'Uploading GST certificate…' : 'Choose GST Certificate (Image or PDF)'}
                    </span>
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp,.pdf"
                      onChange={(e) => handleFileUpload('gstDoc', e.target.files?.[0])}
                      className="hidden"
                      disabled={docs.gstDoc?.uploading}
                    />
                  </label>
                )}
                {errors.gstDoc && <p className="mt-1 text-[11px] text-red-500 font-medium">{errors.gstDoc}</p>}
              </div>
            </div>

            {/* B2B Authorised Contact Person */}
            {isB2B && (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5 mt-1">
                <span className="text-xs font-bold text-slate-800 block">Authorised Contact Person</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Contact Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.contactName}
                      onChange={set('contactName')}
                      placeholder="Signatory name"
                      required
                      className="w-full bg-white border border-slate-300 focus:border-blue-600 text-slate-900 rounded-lg px-3 py-1.5 text-xs outline-none"
                    />
                    {errors.contactName && <p className="mt-0.5 text-[10px] text-red-500">{errors.contactName}</p>}
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Mobile <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      maxLength={10}
                      value={form.contactMobile}
                      onChange={set('contactMobile')}
                      placeholder="10-digit mobile"
                      required
                      className="w-full bg-white border border-slate-300 focus:border-blue-600 text-slate-900 rounded-lg px-3 py-1.5 text-xs outline-none"
                    />
                    {errors.contactMobile && <p className="mt-0.5 text-[10px] text-red-500">{errors.contactMobile}</p>}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= STEP 3: PICKUP & PAYOUT ================= */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-900 block">Warehouse Dispatch / Pickup Address</span>
              <p className="text-[11px] text-slate-500">Couriers collect packaged orders from this address.</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Address Line <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.addressLine}
                    onChange={set('addressLine')}
                    placeholder="Plot / Unit, Street, Area"
                    required
                    className="w-full bg-white border border-slate-300 focus:border-blue-600 text-slate-900 rounded-xl px-3.5 py-2 text-xs outline-none"
                  />
                  {errors.addressLine && <p className="mt-1 text-[10px] text-red-500">{errors.addressLine}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    City <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.city}
                    onChange={set('city')}
                    placeholder="City"
                    required
                    className="w-full bg-white border border-slate-300 focus:border-blue-600 text-slate-900 rounded-xl px-3.5 py-2 text-xs outline-none"
                  />
                  {errors.city && <p className="mt-1 text-[10px] text-red-500">{errors.city}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    State <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.state}
                    onChange={set('state')}
                    placeholder="State"
                    required
                    className="w-full bg-white border border-slate-300 focus:border-blue-600 text-slate-900 rounded-xl px-3.5 py-2 text-xs outline-none"
                  />
                  {errors.state && <p className="mt-1 text-[10px] text-red-500">{errors.state}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Pincode <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={form.pincode}
                    onChange={set('pincode')}
                    placeholder="6-digit pincode"
                    required
                    className="w-full bg-white border border-slate-300 focus:border-blue-600 text-slate-900 rounded-xl px-3.5 py-2 text-xs outline-none font-mono"
                  />
                  {errors.pincode && <p className="mt-1 text-[10px] text-red-500">{errors.pincode}</p>}
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-100">
              <span className="text-xs font-bold text-slate-900 block">Bank Account for Payouts (Optional)</span>
              <p className="text-[11px] text-slate-500">Earnings are settled to this account. You can also update this later.</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Account Holder Name</label>
                  <input
                    type="text"
                    value={form.accountHolderName}
                    onChange={set('accountHolderName')}
                    placeholder="Bank registered name"
                    className="w-full bg-white border border-slate-300 focus:border-blue-600 text-slate-900 rounded-xl px-3.5 py-2 text-xs outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Bank Name</label>
                  <input
                    type="text"
                    value={form.bankName}
                    onChange={set('bankName')}
                    placeholder="e.g. HDFC, ICICI, SBI"
                    className="w-full bg-white border border-slate-300 focus:border-blue-600 text-slate-900 rounded-xl px-3.5 py-2 text-xs outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Account Number</label>
                  <input
                    type="text"
                    value={form.accountNumber}
                    onChange={set('accountNumber')}
                    placeholder="Bank account number"
                    className="w-full bg-white border border-slate-300 focus:border-blue-600 text-slate-900 rounded-xl px-3.5 py-2 text-xs outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">IFSC Code</label>
                  <input
                    type="text"
                    maxLength={11}
                    value={form.ifsc}
                    onChange={(e) => setForm((p) => ({ ...p, ifsc: e.target.value.toUpperCase() }))}
                    placeholder="e.g. HDFC0001234"
                    className="w-full bg-white border border-slate-300 focus:border-blue-600 text-slate-900 rounded-xl px-3.5 py-2 text-xs outline-none font-mono uppercase"
                  />
                  {errors.ifsc && <p className="mt-1 text-[10px] text-red-500">{errors.ifsc}</p>}
                </div>
              </div>
            </div>
          </div>
        )}

        {serverError && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
            {serverError}
          </div>
        )}

        {/* Buttons */}
        <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => {
                setStep(step - 1)
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
              className="py-2.5 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors flex items-center space-x-1.5"
            >
              <HiOutlineArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <button
              type="button"
              onClick={goNext}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-5 rounded-xl shadow-xs transition-colors text-xs flex items-center space-x-1.5"
            >
              <span>Continue</span>
              <HiOutlineArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-5 rounded-xl shadow-xs transition-colors text-xs flex items-center space-x-1.5 disabled:opacity-60"
            >
              {isSubmitting ? <span>Submitting Application…</span> : <span>Submit for Approval</span>}
            </button>
          )}
        </div>
      </form>

      <div className="pt-3 text-center text-xs text-slate-500">
        Already selling on Krozenda?{' '}
        <Link to="/seller/login" className="font-bold text-blue-600 hover:underline">
          Sign In
        </Link>
      </div>
    </VendorAuthShell>
  )
}
