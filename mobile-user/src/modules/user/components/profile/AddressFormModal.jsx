import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, Switch, TextInput, View, StyleSheet } from 'react-native'
import * as Location from 'expo-location'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Sheet } from '../../../../components/ui/Sheet'
import { Text } from '../../../../components/ui/Text'
import { Icon } from '../../../../components/ui/Icon'
import { toast } from '../../../../lib/toast'
import { useAuthStore } from '../../../../lib/authStore'
import { useProfileController } from '../../controllers/useProfileController'
import { useAddressesController } from '../../controllers/useAddressesController'
import { colors, fontFamilyFor, radius, shadows } from '../../../../theme'

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

  const partial = INDIAN_STATES.find((s) => s.toLowerCase().includes(clean) || clean.includes(s.toLowerCase()))
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

// Same keys/services as the web: the postal pincode directory, OpenStreetMap Nominatim and
// BigDataCloud reverse geocoding. Nominatim's usage policy requires an identifying User-Agent,
// which a browser sends on its own and a native fetch does not.
const NOMINATIM_HEADERS = { 'Accept-Language': 'en', 'User-Agent': 'Krozenda-Buyer-App/1.0' }

export function AddressFormModal({ open, initialValues = null, onClose, onSubmit, isSubmitting = false }) {
  const authUser = useAuthStore((s) => s.user)
  const { profile } = useProfileController()
  const { addresses } = useAddressesController()

  const extractCleanPhone = () => {
    const rawPhone = profile?.mobileNumber || authUser?.mobileNumber || profile?.phone || authUser?.phone || ''
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

    return {
      type: 'home',
      fullName: 'Guest',
      phone: cleanPhone || '',
      line1: existingAddress?.line1 || profile?.address?.line1 || (typeof profile?.address === 'string' ? profile.address : '') || '',
      line2: existingAddress?.line2 || profile?.address?.line2 || '',
      city: existingAddress?.city || profile?.address?.city || '',
      state: existingAddress?.state || profile?.address?.state || '',
      pincode: existingAddress?.pincode || profile?.address?.pincode || '',
      isDefault: addresses?.length === 0,
    }
  }

  const [form, setForm] = useState(buildDefaultForm)
  const [error, setError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})
  const [isLocating, setIsLocating] = useState(false)
  const [statePickerOpen, setStatePickerOpen] = useState(false)

  const [prevSeedId, setPrevSeedId] = useState(initialValues?.id ?? null)
  const [prevOpen, setPrevOpen] = useState(open)

  // Reset or seed form whenever the modal opens or the edited address changes
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

  // The last pincode the buyer looked up (delivery check) pre-fills a new address.
  useEffect(() => {
    if (!open || initialValues) return undefined
    let alive = true
    AsyncStorage.getItem('krozenda.lastPincode')
      .then((lastPin) => {
        if (alive && lastPin) setForm((prev) => (prev.pincode ? prev : { ...prev, pincode: lastPin }))
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [open, initialValues])

  const currentCleanPhone = extractCleanPhone()
  const [syncedPhone, setSyncedPhone] = useState(currentCleanPhone)

  // If the phone arrived after the first render and the form phone is still empty:
  if (!initialValues && open && currentCleanPhone && currentCleanPhone !== syncedPhone) {
    setSyncedPhone(currentCleanPhone)
    if (!form.phone) {
      setForm((prev) => ({ ...prev, phone: currentCleanPhone }))
    }
  }

  // If an existing address arrived after the first render and the form address is still empty:
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

  const clearFieldError = (field) => {
    setFieldErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev))
  }

  const update = (field) => (value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    clearFieldError(field)
  }

  const handlePhoneChange = (text) => {
    let digits = text.replace(/\D/g, '')
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
    clearFieldError('phone')
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

  const handlePincodeChange = (text) => {
    const digits = text.replace(/\D/g, '').slice(0, 6)
    setForm((prev) => ({ ...prev, pincode: digits }))
    clearFieldError('pincode')
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

  const handleDetectLocation = async () => {
    setIsLocating(true)
    try {
      const permission = await Location.requestForegroundPermissionsAsync()
      if (!permission.granted) {
        toast.error('Permission Denied', 'Please allow location permission to auto-fill your address.')
        return
      }

      let pos
      try {
        pos = await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 10000)),
        ])
      } catch (err) {
        if (err?.message === 'timeout') {
          toast.error('Timeout', 'Location request timed out. Please enter address manually.')
        } else {
          toast.error('Location Unavailable', 'Current location could not be determined.')
        }
        return
      }

      const { latitude, longitude } = pos.coords
      try {
        let addressData = null

        // Try OpenStreetMap Nominatim reverse geocode first
        try {
          const resp = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&addressdetails=1`,
            { headers: NOMINATIM_HEADERS },
          )
          if (resp.ok) {
            const data = await resp.json()
            // display_name is the full one-line address; kept as the fallback for line 1
            // when the structured parts are thin.
            if (data.address) addressData = { ...data.address, display_name: data.display_name }
          }
        } catch {
          // fallback
        }

        if (!addressData) {
          // Fallback to BigDataCloud
          try {
            const resp = await fetch(
              `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`,
            )
            if (resp.ok) {
              const bdc = await resp.json()
              addressData = {
                postcode: bdc.postcode,
                state: bdc.principalSubdivision,
                city: bdc.city || bdc.locality,
                road: bdc.localityInfo?.administrative?.[3]?.name || bdc.locality,
                display_name: [bdc.locality, bdc.city, bdc.principalSubdivision, bdc.postcode].filter(Boolean).join(', '),
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
            addressData.city || addressData.town || addressData.village || addressData.county || addressData.state_district || ''
          const unique = (parts) => [...new Set(parts.filter(Boolean))]
          // Line 1: the most specific place the geocoder knows - building, house number, street.
          // Many Indian locations come back with no street at all, so fall back to the locality,
          // and failing that to the start of the full one-line address.
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
          const line2 = unique([addressData.neighbourhood, addressData.suburb, addressData.quarter, addressData.city_district])
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

          toast.success('Location Detected', 'Your address details have been auto-filled.')
        } else {
          toast.error('Location Error', 'Unable to resolve address from coordinates.')
        }
      } catch {
        toast.error('Location Error', 'Failed to fetch address for your location.')
      }
    } catch {
      toast.error('Location Unavailable', 'Current location could not be determined.')
    } finally {
      setIsLocating(false)
    }
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

  const handleSubmit = async () => {
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
    <Sheet visible={open} onClose={handleClose} maxHeight="92%">
      <View style={styles.head}>
        <Text style={{ fontSize: 14, fontWeight: '800', color: colors.slate[900] }}>
          {initialValues?.id ? 'Edit Address' : 'Add New Address'}
        </Text>
        <Pressable onPress={handleClose} style={{ padding: 6, borderRadius: 9999 }}>
          <Icon name="HiXMark" size={20} color={colors.slate[500]} />
        </Pressable>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 16 }}>
        {/* Address type selector */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {TYPES.map((t) => {
            const active = form.type === t.id
            return (
              <Pressable
                key={t.id}
                onPress={() => setForm((prev) => ({ ...prev, type: t.id }))}
                style={[
                  styles.typeBtn,
                  active
                    ? { backgroundColor: colors.blue[600], borderColor: colors.blue[600] }
                    : { backgroundColor: '#fff', borderColor: colors.slate[200] },
                ]}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: active ? '#fff' : colors.slate[600] }}>{t.label}</Text>
              </Pressable>
            )
          })}
        </View>

        {/* Use my current location */}
        <Pressable
          onPress={handleDetectLocation}
          disabled={isLocating}
          style={({ pressed }) => [
            styles.locate,
            shadows['2xs'],
            { backgroundColor: pressed ? colors.blue[100] : 'rgba(239,246,255,0.8)', opacity: isLocating ? 0.6 : 1 },
          ]}
        >
          {isLocating ? (
            <>
              <ActivityIndicator size="small" color={colors.blue[600]} />
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.blue[700] }}>Detecting your current location...</Text>
            </>
          ) : (
            <>
              <Icon name="HiMapPin" size={16} color={colors.blue[600]} />
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.blue[700] }}>Use My Current Location</Text>
            </>
          )}
        </Pressable>

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Field
            style={{ flex: 1 }}
            label="Full Name"
            value={form.fullName}
            onChangeText={update('fullName')}
            error={fieldErrors.fullName}
            placeholder="Recipient name"
            required
          />
          <Field
            style={{ flex: 1 }}
            label="Phone Number"
            keyboardType="number-pad"
            maxLength={10}
            placeholder="10-digit mobile number"
            value={form.phone}
            onChangeText={handlePhoneChange}
            onBlur={handlePhoneBlur}
            error={fieldErrors.phone}
            required
          />
        </View>

        <Field
          label="Address Line 1"
          value={form.line1}
          onChangeText={update('line1')}
          error={fieldErrors.line1}
          placeholder="Flat, House no., Building, Apartment"
          required
        />
        <Field label="Address Line 2 (optional)" value={form.line2} onChangeText={update('line2')} placeholder="Area, Street, Sector, Village" />

        <Field label="City" value={form.city} onChangeText={update('city')} error={fieldErrors.city} placeholder="City / District" required />

        <View style={{ gap: 4 }}>
          <Text style={styles.label}>
            State
            <Text noTranslate style={{ color: colors.red[500] }}>
              {' *'}
            </Text>
          </Text>
          <Pressable
            onPress={() => setStatePickerOpen(true)}
            style={[
              styles.input,
              {
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderColor: fieldErrors.state ? colors.red[400] : colors.slate[200],
                backgroundColor: fieldErrors.state ? 'rgba(254,242,242,0.3)' : colors.slate[50],
              },
            ]}
          >
            <Text numberOfLines={1} style={{ flex: 1, fontSize: 12, fontWeight: '600', color: form.state ? colors.slate[900] : colors.slate[400] }}>
              {form.state || 'Select State'}
            </Text>
            <Icon name="HiChevronUpDown" size={16} color={colors.slate[400]} />
          </Pressable>
          {fieldErrors.state ? <Text style={styles.error}>{fieldErrors.state}</Text> : null}
        </View>

        <Field
          label="Pincode"
          keyboardType="number-pad"
          maxLength={6}
          placeholder="6 digits"
          value={form.pincode}
          onChangeText={handlePincodeChange}
          onBlur={handlePincodeBlur}
          error={fieldErrors.pincode}
          required
        />

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Switch
            value={form.isDefault}
            onValueChange={(v) => setForm((prev) => ({ ...prev, isDefault: v }))}
            trackColor={{ false: colors.slate[300], true: colors.blue[300] }}
            thumbColor={form.isDefault ? colors.blue[600] : '#f4f4f5'}
          />
          <Text style={{ fontSize: 12, fontWeight: '600', color: colors.slate[700] }}>Set as default address</Text>
        </View>

        {error ? <Text style={{ fontSize: 12, fontWeight: '600', color: colors.red[600] }}>{error}</Text> : null}

        <Pressable
          onPress={handleSubmit}
          disabled={isSubmitting}
          style={({ pressed }) => [
            styles.submit,
            { backgroundColor: pressed ? colors.blue[700] : colors.blue[600], opacity: isSubmitting ? 0.6 : 1 },
          ]}
        >
          <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff', letterSpacing: 0.3 }}>
            {isSubmitting ? 'Saving...' : 'Save Address'}
          </Text>
        </Pressable>
      </ScrollView>

      <StatePicker
        open={statePickerOpen}
        value={form.state}
        onClose={() => setStatePickerOpen(false)}
        onChange={(st) => {
          setForm((prev) => ({ ...prev, state: st }))
          clearFieldError('state')
          setStatePickerOpen(false)
        }}
      />
    </Sheet>
  )
}

function StatePicker({ open, value, onChange, onClose }) {
  const [search, setSearch] = useState('')

  const filteredStates = useMemo(() => {
    if (!search.trim()) return INDIAN_STATES
    const q = search.trim().toLowerCase()
    return INDIAN_STATES.filter((s) => s.toLowerCase().includes(q))
  }, [search])

  const close = () => {
    setSearch('')
    onClose()
  }

  return (
    <Sheet visible={open} onClose={close} maxHeight="75%">
      <View style={styles.searchHead}>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <View style={{ position: 'absolute', left: 10, zIndex: 1 }}>
            <Icon name="HiMagnifyingGlass" size={16} color={colors.slate[400]} />
          </View>
          <TextInput
            value={search}
            onChangeText={setSearch}
            autoFocus
            placeholder="Search State or UT..."
            placeholderTextColor={colors.slate[400]}
            style={styles.searchInput}
          />
          {search ? (
            <Pressable onPress={() => setSearch('')} style={{ position: 'absolute', right: 8, padding: 2 }}>
              <Icon name="HiXMark" size={14} color={colors.slate[400]} />
            </Pressable>
          ) : null}
        </View>
        <Pressable onPress={close} style={{ padding: 6, borderRadius: 9999 }}>
          <Icon name="HiXMark" size={20} color={colors.slate[500]} />
        </Pressable>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 420 }} contentContainerStyle={{ padding: 4 }}>
        {filteredStates.length > 0 ? (
          filteredStates.map((st) => {
            const isSelected = value?.toLowerCase() === st.toLowerCase()
            return (
              <Pressable
                key={st}
                onPress={() => {
                  setSearch('')
                  onChange(st)
                }}
                style={({ pressed }) => [
                  styles.stateRow,
                  (isSelected || pressed) && { backgroundColor: isSelected ? colors.blue[50] : 'rgba(241,245,249,0.8)' },
                ]}
              >
                <Text numberOfLines={1} style={{ flex: 1, fontSize: 12, fontWeight: isSelected ? '700' : '500', color: isSelected ? colors.blue[700] : colors.slate[700] }}>
                  {st}
                </Text>
                {isSelected ? <Icon name="HiCheck" size={16} color={colors.blue[600]} /> : null}
              </Pressable>
            )
          })
        ) : (
          <Text style={{ paddingVertical: 24, paddingHorizontal: 12, textAlign: 'center', fontSize: 12, color: colors.slate[400], fontWeight: '500' }}>
            {`No state found for "${search}"`}
          </Text>
        )}
      </ScrollView>
      <View style={styles.stateFoot}>
        <Text noTranslate style={{ fontSize: 10, fontWeight: '600', color: colors.slate[400] }}>
          {filteredStates.length} of {INDIAN_STATES.length} States & UTs
        </Text>
      </View>
    </Sheet>
  )
}

function Field({ label, required, error, style, ...props }) {
  const [focused, setFocused] = useState(false)
  return (
    <View style={[{ gap: 4 }, style]}>
      <Text style={styles.label}>
        {label}
        {required ? (
          <Text noTranslate style={{ color: colors.red[500] }}>
            {' *'}
          </Text>
        ) : null}
      </Text>
      <TextInput
        {...props}
        placeholderTextColor={colors.slate[400]}
        onFocus={(e) => {
          setFocused(true)
          props.onFocus?.(e)
        }}
        onBlur={(e) => {
          setFocused(false)
          props.onBlur?.(e)
        }}
        style={[
          styles.input,
          {
            color: colors.slate[900],
            backgroundColor: error ? 'rgba(254,242,242,0.3)' : focused ? '#fff' : colors.slate[50],
            borderColor: error ? colors.red[400] : focused ? colors.blue[500] : colors.slate[200],
            borderWidth: focused ? 2 : 1,
          },
        ]}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  head: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  typeBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.xl, borderWidth: 1 },
  locate: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.blue[200],
  },
  label: { fontSize: 11, fontWeight: '700', color: colors.slate[500] },
  input: {
    minHeight: 40,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.xl,
    borderWidth: 1,
    fontSize: 12,
    fontFamily: fontFamilyFor('600'),
  },
  error: { fontSize: 10.5, fontWeight: '600', color: colors.red[600] },
  submit: { width: '100%', paddingVertical: 12, borderRadius: radius.xl, alignItems: 'center' },
  searchHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
    backgroundColor: 'rgba(248,250,252,0.9)',
  },
  searchInput: {
    height: 36,
    paddingLeft: 32,
    paddingRight: 28,
    paddingVertical: 0,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.slate[200],
    backgroundColor: '#fff',
    fontSize: 12,
    color: colors.slate[900],
    fontFamily: fontFamilyFor('600'),
  },
  stateRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12, borderRadius: radius.lg },
  stateFoot: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.slate[50],
    borderTopWidth: 1,
    borderTopColor: colors.slate[100],
    alignItems: 'flex-end',
  },
})
