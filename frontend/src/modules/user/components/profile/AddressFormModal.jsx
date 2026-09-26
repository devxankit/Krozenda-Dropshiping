import { useState, useEffect, useRef, useMemo } from 'react'
import {
  HiXMark,
  HiMapPin,
  HiChevronUpDown,
  HiMagnifyingGlass,
  HiCheck,
} from 'react-icons/hi2'
import { toast } from '../../../../lib/toast'
import { useAuthStore } from '../../../../lib/authStore'
import { useProfileController } from '../../controllers/useProfileController'
import { useAddressesController } from '../../controllers/useAddressesController'

const TYPES = [
  { id: 'home', label: 'Home' },
  { id: 'office', label: 'Office' },
  { id: 'other', label: 'Other' },
]

const INDIAN_STATES = [
  'Andaman and Nicobar Islands',
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chandigarh',
  'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jammu and Kashmir',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Ladakh',
  'Lakshadweep',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Puducherry',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
]

const ALIAS_MAP = {
  orissa: 'Odisha',
  pondicherry: 'Puducherry',
  'jammu & kashmir': 'Jammu and Kashmir',
  'andaman & nicobar': 'Andaman and Nicobar Islands',
  'nct of delhi': 'Delhi',
  'new delhi': 'Delhi',
  'national capital territory of delhi': 'Delhi',
  uttaranchal: 'Uttarakhand',
  'daman and diu': 'Dadra and Nagar Haveli and Daman and Diu',
  'dadra and nagar haveli': 'Dadra and Nagar Haveli and Daman and Diu',
}

function matchIndianState(raw) {
  if (!raw) return ''
  const clean = raw.trim().toLowerCase().replace(/&/g, 'and')
  const exact = INDIAN_STATES.find((s) => s.toLowerCase() === clean)
  if (exact) return exact
  if (ALIAS_MAP[clean]) return ALIAS_MAP[clean]

  const partial = INDIAN_STATES.find(
    (s) => s.toLowerCase().includes(clean) || clean.includes(s.toLowerCase())
  )
  return partial || raw
}

const EMPTY_FORM = {
  type: 'home',
  fullName: 'Guest',
  phone: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  pincode: '',
  isDefault: false,
}

export function AddressFormModal({ open, initialValues = null, onClose, onSubmit, isSubmitting = false }) {
  const authUser = useAuthStore((s) => s.user)
  const { profile } = useProfileController()
  const { addresses } = useAddressesController()

  const extractCleanPhone = () => {
    const rawPhone =
      profile?.mobileNumber ||
      authUser?.mobileNumber ||
      profile?.phone ||
      authUser?.phone ||
      ''
    let cleanPhone = String(rawPhone || '').replace(/\D/g, '')
    if (cleanPhone.length > 10) {
      if (cleanPhone.startsWith('91') && cleanPhone.length === 12) {
        cleanPhone = cleanPhone.slice(2)
      } else if (cleanPhone.startsWith('0') && cleanPhone.length === 11) {
        cleanPhone = cleanPhone.slice(1)
      } else {
        cleanPhone = cleanPhone.slice(-10)
      }
    }
    return cleanPhone
  }

  const buildDefaultForm = () => {
    if (initialValues) {
      return { ...EMPTY_FORM, ...initialValues }
    }
    const cleanPhone = extractCleanPhone()
    const existingAddress = addresses?.find((a) => a.isDefault) || addresses?.[0]
    const lastPin = localStorage.getItem('krozenda.lastPincode') || ''

    return {
      type: 'home',
      fullName: 'Guest',
      phone: cleanPhone || '',
      line1: existingAddress?.line1 || profile?.address?.line1 || (typeof profile?.address === 'string' ? profile.address : '') || '',
      line2: existingAddress?.line2 || profile?.address?.line2 || '',
      city: existingAddress?.city || profile?.address?.city || '',
      state: existingAddress?.state || profile?.address?.state || '',
      pincode: existingAddress?.pincode || profile?.address?.pincode || lastPin || '',
      isDefault: addresses?.length === 0,
    }
  }

  const [form, setForm] = useState(buildDefaultForm)
  const [error, setError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})
  const [isLocating, setIsLocating] = useState(false)

  const [prevSeedId, setPrevSeedId] = useState(initialValues?.id ?? null)
  const [prevOpen, setPrevOpen] = useState(open)

  // Reset or seed form whenever modal opens or edited address changes
  if (open !== prevOpen || (initialValues?.id ?? null) !== prevSeedId) {
    setPrevOpen(open)
    setPrevSeedId(initialValues?.id ?? null)
    if (open) {
      setForm(buildDefaultForm())
      setError(null)
      setFieldErrors({})
      setIsLocating(false)
    }
  }

  const currentCleanPhone = extractCleanPhone()
  const [syncedPhone, setSyncedPhone] = useState(currentCleanPhone)

  // If phone arrived after initial render and form phone is still empty:
  if (!initialValues && open && currentCleanPhone && currentCleanPhone !== syncedPhone) {
    setSyncedPhone(currentCleanPhone)
    if (!form.phone) {
      setForm((prev) => ({ ...prev, phone: currentCleanPhone }))
    }
  }

  // If existing address arrived after initial render and form address is still empty:
  const existingAddress = addresses?.find((a) => a.isDefault) || addresses?.[0]
  const [syncedAddressId, setSyncedAddressId] = useState(existingAddress?.id ?? null)
  if (!initialValues && open && existingAddress && existingAddress.id !== syncedAddressId) {
    setSyncedAddressId(existingAddress.id)
    setForm((prev) => ({
      ...prev,
      line1: prev.line1 || existingAddress.line1 || '',
      line2: prev.line2 || existingAddress.line2 || '',
      city: prev.city || existingAddress.city || '',
      state: prev.state || existingAddress.state || '',
      pincode: prev.pincode || existingAddress.pincode || '',
    }))
  }

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

  const lookupPincode = async (pin) => {
    if (!/^\d{6}$/.test(pin)) return
    try {
      const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`)
      if (!res.ok) return
      const data = await res.json()
      if (Array.isArray(data) && data[0]?.Status === 'Success' && data[0]?.PostOffice?.length > 0) {
        const po = data[0].PostOffice[0]
        const stateName = matchIndianState(po.State)
        const cityName = po.District || po.Division || po.Block || ''
        setForm((prev) => ({
          ...prev,
          state: stateName || prev.state,
          city: prev.city || cityName,
        }))
        if (stateName) {
          setFieldErrors((prev) => ({ ...prev, state: undefined }))
        }
        if (cityName) {
          setFieldErrors((prev) => ({ ...prev, city: undefined }))
        }
      }
    } catch {
      // Ignore network errors
    }
  }

  const handlePincodeChange = (e) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 6)
    setForm((prev) => ({ ...prev, pincode: digits }))
    if (fieldErrors.pincode) {
      setFieldErrors((prev) => ({ ...prev, pincode: undefined }))
    }
    if (digits.length === 6) {
      lookupPincode(digits)
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

  const handleDetectLocation = ({ silent = false } = {}) => {
    if (!navigator.geolocation) {
      if (!silent) toast.error('Location Error', 'Geolocation is not supported by your browser')
      return
    }

    setIsLocating(true)

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords
        try {
          let addressData = null

          // Try OpenStreetMap Nominatim reverse geocode first
          try {
            const resp = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&addressdetails=1`,
              { headers: { 'Accept-Language': 'en' } }
            )
            if (resp.ok) {
              const data = await resp.json()
              // display_name is the full one-line address; kept as the
              // fallback for line 1 when the structured parts are thin.
              if (data.address) addressData = { ...data.address, display_name: data.display_name }
            }
          } catch {
            // fallback
          }

          if (!addressData) {
            // Fallback to BigDataCloud
            try {
              const resp = await fetch(
                `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
              )
              if (resp.ok) {
                const bdc = await resp.json()
                addressData = {
                  postcode: bdc.postcode,
                  state: bdc.principalSubdivision,
                  city: bdc.city || bdc.locality,
                  road: bdc.localityInfo?.administrative?.[3]?.name || bdc.locality,
                  display_name: [bdc.locality, bdc.city, bdc.principalSubdivision, bdc.postcode]
                    .filter(Boolean)
                    .join(', '),
                }
              }
            } catch {
              // fallback
            }
          }

          if (addressData) {
            const pincode = (addressData.postcode || '').replace(/\D/g, '').slice(0, 6)
            const matchedState = matchIndianState(addressData.state || '')
            const city =
              addressData.city ||
              addressData.town ||
              addressData.village ||
              addressData.county ||
              addressData.state_district ||
              ''
            const unique = (parts) => [...new Set(parts.filter(Boolean))]
            // Line 1: the most specific place the geocoder knows — building,
            // house number, street. Many Indian locations come back with no
            // street at all, so fall back to the locality, and failing that
            // to the start of the full one-line address.
            let line1Parts = unique([
              addressData.building || addressData.house_name || addressData.amenity || addressData.shop,
              addressData.house_number,
              addressData.road || addressData.pedestrian || addressData.residential || addressData.street,
            ])
            if (line1Parts.length === 0) {
              line1Parts = unique([addressData.neighbourhood, addressData.quarter, addressData.hamlet])
            }
            if (line1Parts.length === 0 && addressData.display_name) {
              line1Parts = addressData.display_name
                .split(',')
                .map((part) => part.trim())
                .filter((part) => part && part !== city && !/^\d{6}$/.test(part))
                .slice(0, 2)
            }
            const line1 = line1Parts.join(', ')
            const line2 = unique([
              addressData.neighbourhood,
              addressData.suburb,
              addressData.quarter,
              addressData.city_district,
            ])
              .filter((part) => !line1Parts.includes(part) && part !== city)
              .join(', ')

            setForm((prev) => ({
              ...prev,
              ...(pincode ? { pincode } : {}),
              ...(matchedState ? { state: matchedState } : {}),
              ...(city ? { city } : {}),
              ...(line1 ? { line1 } : {}),
              ...(line2 ? { line2 } : {}),
            }))

            setFieldErrors((prev) => ({
              ...prev,
              ...(pincode ? { pincode: undefined } : {}),
              ...(matchedState ? { state: undefined } : {}),
              ...(city ? { city: undefined } : {}),
              ...(line1 ? { line1: undefined } : {}),
            }))

            if (!silent) {
              toast.success('Location Detected', 'Your address details have been auto-filled.')
            }
          } else if (!silent) {
            toast.error('Location Error', 'Unable to resolve address from coordinates.')
          }
        } catch {
          if (!silent) toast.error('Location Error', 'Failed to fetch address for your location.')
        } finally {
          setIsLocating(false)
        }
      },
      (err) => {
        setIsLocating(false)
        if (!silent) {
          if (err.code === 1) {
            toast.error('Permission Denied', 'Please allow location permission in your browser to auto-fill address.')
          } else if (err.code === 2) {
            toast.error('Location Unavailable', 'Current location could not be determined.')
          } else {
            toast.error('Timeout', 'Location request timed out. Please enter address manually.')
          }
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    )
  }

  const handleClose = () => {
    setForm({ ...EMPTY_FORM })
    setError(null)
    setFieldErrors({})
    setIsLocating(false)
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
          {/* Address Type Selector */}
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

          {/* Use My Current Location Action Button */}
          <button
            type="button"
            onClick={handleDetectLocation}
            disabled={isLocating}
            className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl border border-blue-200 bg-blue-50/80 hover:bg-blue-100 text-blue-700 text-xs font-bold transition-all shadow-2xs group disabled:opacity-60 cursor-pointer"
          >
            {isLocating ? (
              <>
                <svg className="animate-spin h-4 w-4 text-blue-600" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span>Detecting your current location...</span>
              </>
            ) : (
              <>
                <HiMapPin className="w-4 h-4 text-blue-600 group-hover:scale-110 transition-transform" />
                <span>Use My Current Location</span>
              </>
            )}
          </button>

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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
            <Field
              label="City"
              value={form.city}
              onChange={update('city')}
              error={fieldErrors.city}
              placeholder="City / District"
              required
            />
            <SearchableStateSelect
              value={form.state}
              onChange={(st) => {
                setForm((prev) => ({ ...prev, state: st }))
                if (fieldErrors.state) {
                  setFieldErrors((prev) => ({ ...prev, state: undefined }))
                }
              }}
              error={fieldErrors.state}
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
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold py-3 rounded-xl text-xs tracking-wide transition-colors cursor-pointer"
          >
            {isSubmitting ? 'Saving...' : 'Save Address'}
          </button>
        </form>
      </div>
    </div>
  )
}

function SearchableStateSelect({ value, onChange, error, required }) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const dropdownRef = useRef(null)
  const searchInputRef = useRef(null)

  const filteredStates = useMemo(() => {
    if (!search.trim()) return INDIAN_STATES
    const q = search.trim().toLowerCase()
    return INDIAN_STATES.filter((s) => s.toLowerCase().includes(q))
  }, [search])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false)
        setSearch('')
      }
    }
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
        setSearch('')
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)
      setTimeout(() => searchInputRef.current?.focus(), 60)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const handleSelect = (stateName) => {
    onChange(stateName)
    setIsOpen(false)
    setSearch('')
  }

  return (
    <div className="relative space-y-1" ref={dropdownRef}>
      <label className="block text-[11px] font-bold text-slate-500">
        State {required && <span className="text-red-500">*</span>}
      </label>

      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full px-3 py-2.5 bg-slate-50 border rounded-xl text-xs font-semibold text-left flex items-center justify-between transition-colors cursor-pointer ${
          error
            ? 'border-red-400 focus:ring-2 focus:ring-red-500 bg-red-50/30'
            : isOpen
              ? 'border-blue-500 ring-2 ring-blue-500/20 bg-white'
              : 'border-slate-200 hover:border-slate-300'
        } ${value ? 'text-slate-900' : 'text-slate-400'}`}
      >
        <span className="truncate">{value || 'Select State'}</span>
        <HiChevronUpDown className="w-4 h-4 text-slate-400 shrink-0 ml-1" />
      </button>

      {error && <p className="text-[10.5px] font-semibold text-red-600">{error}</p>}

      {/* Floating Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-64 sm:max-h-72">
          {/* Search Header */}
          <div className="p-2 border-b border-slate-100 bg-slate-50/90 sticky top-0 z-10">
            <div className="relative flex items-center">
              <HiMagnifyingGlass className="w-4 h-4 text-slate-400 absolute left-2.5 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search State or UT..."
                className="w-full pl-8 pr-7 py-1.5 text-xs font-semibold bg-white border border-slate-200 rounded-lg placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 p-0.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <HiXMark className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Options List */}
          <div className="overflow-y-auto p-1 divide-y divide-slate-50 no-scrollbar">
            {filteredStates.length > 0 ? (
              filteredStates.map((st) => {
                const isSelected = value?.toLowerCase() === st.toLowerCase()
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => handleSelect(st)}
                    className={`w-full text-left px-3 py-2 text-xs rounded-lg flex items-center justify-between transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50 text-blue-700 font-bold'
                        : 'text-slate-700 hover:bg-slate-100/80 font-medium'
                    }`}
                  >
                    <span className="truncate">{st}</span>
                    {isSelected && <HiCheck className="w-4 h-4 text-blue-600 shrink-0 ml-1.5" />}
                  </button>
                )
              })
            ) : (
              <div className="py-6 px-3 text-center text-xs text-slate-400 font-medium">
                No state found for &quot;{search}&quot;
              </div>
            )}
          </div>
          <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-400 font-semibold text-right">
            {filteredStates.length} of {INDIAN_STATES.length} States & UTs
          </div>
        </div>
      )}
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
