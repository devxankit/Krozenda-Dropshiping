import { useRef, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import * as DocumentPicker from 'expo-document-picker'
import { useRouter } from 'expo-router'
import { VendorAuthShell } from '../components/shell/VendorAuthShell'
import { AuthButton, AuthError, AuthInput, AuthLabel, AuthSelect } from '../components/auth/AuthFields'
import { Icon } from '../../../components/ui/Icon'
import { Text } from '../../../components/ui/Text'
import { toast } from '../../../lib/toast'
import { useVendorRegisterController } from '../controllers/useVendorController'
import { uploadRegistrationDocument } from '../services/authService'
import { PolicyAcceptanceModal } from '../components/modals/PolicyAcceptanceModal'
import { AUTH_ROUTES } from '../../../config/routes'
import { colors, shadows } from '../../../theme'

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
  sellsFood: 'false',
  fssaiNumber: '',
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

const SELLER_TYPES = [
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
]

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']

function validateStep(step, form, docs, policyAcceptances) {
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
    if (form.sellsFood === 'true') {
      if (!/^\d{14}$/.test(form.fssaiNumber.trim())) errors.fssaiNumber = 'Enter your 14-digit FSSAI licence number'
      if (!docs.fssaiDoc?.url) errors.fssaiDoc = 'Please upload your FSSAI licence'
      if (!docs.foodTestDoc?.url) errors.foodTestDoc = 'Please upload your food test certificate'
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
    if (!policyAcceptances) {
      errors.policies = 'Please read and accept the seller policies to continue'
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
  const router = useRouter()
  const { register, isSubmitting } = useVendorRegisterController()
  const scrollRef = useRef(null)
  const [step, setStep] = useState(1)
  const [form, setForm] = useState(BLANK)
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState(null)
  const [isSubmitted, setIsSubmitted] = useState(false)
  // Null until the seller has scrolled through and accepted every mandatory
  // CMS policy in the modal; then the { slug, title, version } list sent up.
  const [policyAcceptances, setPolicyAcceptances] = useState(null)
  const [policyModalOpen, setPolicyModalOpen] = useState(false)

  // Direct Document Upload states
  const [docs, setDocs] = useState({
    panDoc: null, // { url, filename, originalname, uploading }
    gstDoc: null,
    fssaiDoc: null,
    foodTestDoc: null,
  })

  const isB2B = form.vendorType === 'B2B'
  const scrollTop = () => scrollRef.current?.scrollTo({ y: 0, animated: true })

  const setValue = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev))
  }
  // Props for a plain text field bound to form[key].
  const bind = (key, transform) => ({
    value: form[key],
    onChangeText: (v) => setValue(key, transform ? transform(v) : v),
    error: errors[key],
  })

  async function handlePick(field) {
    if (docs[field]?.uploading) return
    let result
    try {
      result = await DocumentPicker.getDocumentAsync({ type: ALLOWED_TYPES, copyToCacheDirectory: true, multiple: false })
    } catch {
      setErrors((prev) => ({ ...prev, [field]: 'Could not open the file picker.' }))
      return
    }
    if (result.canceled || !result.assets?.length) return
    const asset = result.assets[0]
    const type = asset.mimeType || guessMime(asset.name)
    const file = { uri: asset.uri, name: asset.name || `document-${Date.now()}`, type, size: asset.size }

    if (!ALLOWED_TYPES.includes(file.type)) {
      setErrors((prev) => ({ ...prev, [field]: 'Only JPG, PNG, WebP or PDF files are allowed' }))
      return
    }
    if (file.size && file.size > 10 * 1024 * 1024) {
      setErrors((prev) => ({ ...prev, [field]: 'File size must be under 10MB' }))
      return
    }

    try {
      setDocs((prev) => ({ ...prev, [field]: { uploading: true, originalname: file.name } }))
      setErrors((prev) => ({ ...prev, [field]: undefined }))

      const res = await uploadRegistrationDocument({ uri: file.uri, name: file.name, type: file.type })

      setDocs((prev) => ({
        ...prev,
        [field]: { url: res.url, filename: res.filename, originalname: file.name, uploading: false },
      }))
      toast.success('Document uploaded', `${file.name} ready for verification.`)
    } catch (err) {
      setDocs((prev) => ({ ...prev, [field]: null }))
      setErrors((prev) => ({
        ...prev,
        [field]: err?.response?.data?.message || err?.message || 'Upload failed. Please try another file.',
      }))
      toast.error('Upload failed', 'Could not upload document')
    }
  }

  function goNext() {
    const found = validateStep(step, form, docs)
    setErrors(found)
    if (Object.keys(found).length === 0) {
      setStep(step + 1)
      scrollTop()
    }
  }

  async function handleSubmit() {
    if (isSubmitting) return
    setServerError(null)

    const found = validateStep(3, form, docs, policyAcceptances)
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
    if (form.sellsFood === 'true' && docs.fssaiDoc?.url) {
      documents.push({
        documentType: 'FSSAI_LICENSE',
        documentLabel: 'FSSAI Food Safety Licence',
        documentNumber: form.fssaiNumber.trim(),
        documentUrl: docs.fssaiDoc.url,
      })
    }
    if (form.sellsFood === 'true' && docs.foodTestDoc?.url) {
      documents.push({
        documentType: 'FOOD_TEST_CERTIFICATE',
        documentLabel: 'Food Test Certificate',
        documentUrl: docs.foodTestDoc.url,
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
      sellsFood: form.sellsFood === 'true',
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
      policyAcceptances: policyAcceptances.map(({ slug, version }) => ({ slug, version })),
    }

    try {
      await register(payload)
      toast.success('Registration submitted', 'Your application is under review by admin.')
      setIsSubmitted(true)
      scrollTop()
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || 'Could not create your account'
      // Admin republished a policy (or the list changed) while this form was
      // open: the old acceptance no longer counts, so make them read it again.
      const code = err?.response?.data?.code || err?.code
      if (code === 'POLICY_VERSION_CHANGED' || code === 'POLICIES_NOT_ACCEPTED') {
        setPolicyAcceptances(null)
      }
      setServerError(message)
      toast.error('Registration failed', message)
    }
  }

  // ================= SUBMISSION SUCCESS / APPROVAL PENDING VIEW =================
  if (isSubmitted) {
    return (
      <VendorAuthShell scrollRef={scrollRef} title="Application Submitted" subtitle="Your registration is under review by Krozenda Admin">
        <View style={{ alignItems: 'center', paddingVertical: 12, gap: 16 }}>
          <View style={styles.successIcon}>
            <Icon name="HiOutlineShieldCheck" size={32} color={colors.success[600]} />
          </View>

          <View style={{ alignItems: 'center' }}>
            <Text style={styles.successTitle}>Registration Received!</Text>
            <Text style={styles.successDesc}>
              Your details and verification documents (PAN & GST) have been submitted to Admin. Once approved, you will be able to log in to your dashboard.
            </Text>
          </View>

          <View style={styles.summary}>
            <SummaryRow label="Applicant Name:" value={form.name} />
            <SummaryRow label="Registered Email:" value={form.email} />
            <SummaryRow label="Store / Business:" value={form.businessName || 'Individual Seller'} />
            <View style={[styles.summaryRow, styles.summaryLast]}>
              <Text style={styles.summaryLabel}>Account Status:</Text>
              <View style={styles.pending}>
                <Text style={styles.pendingText}>Pending Admin Approval</Text>
              </View>
            </View>
          </View>

          <Text style={styles.successNote}>Our compliance team usually reviews and approves accounts within 24 business hours.</Text>

          <AuthButton onPress={() => router.replace(AUTH_ROUTES.LOGIN)} style={[{ alignSelf: 'stretch' }, shadows.xs]}>
            Go to Seller Login
          </AuthButton>
        </View>
      </VendorAuthShell>
    )
  }

  return (
    <VendorAuthShell
      scrollRef={scrollRef}
      title="Create Seller Account"
      subtitle="Register your store and upload your PAN/GST documents for approval"
    >
      {/* Clean Minimal Stepper (step labels are hidden below the sm breakpoint) */}
      <View style={styles.stepper}>
        {STEPS.map((s, idx) => {
          const isDone = step > s.num
          const isCurrent = step === s.num
          return (
            <View key={s.num} style={styles.stepItem}>
              <View
                style={[
                  styles.stepCircle,
                  isDone
                    ? { backgroundColor: colors.success[600] }
                    : isCurrent
                      ? [{ backgroundColor: colors.brand[600] }, shadows.xs]
                      : { backgroundColor: colors.slate[100], borderWidth: 1, borderColor: colors.slate[200] },
                ]}
                accessibilityLabel={`Step ${s.num}: ${s.label}`}
              >
                {isDone ? (
                  <Icon name="HiOutlineCheck" size={16} color="#fff" />
                ) : (
                  <Text noTranslate style={[styles.stepNum, { color: isCurrent ? '#fff' : colors.slate[500] }]}>
                    {s.num}
                  </Text>
                )}
              </View>
              {idx < STEPS.length - 1 ? (
                <View style={[styles.stepLine, { backgroundColor: step > s.num ? colors.success[500] : colors.slate[200] }]} />
              ) : null}
            </View>
          )
        })}
      </View>

      <View style={{ gap: 16 }}>
        {/* ================= STEP 1: ACCOUNT ================= */}
        {step === 1 && (
          <View style={{ gap: 16 }}>
            <View>
              <AuthLabel required style={{ marginBottom: 6 }}>
                I am selling as
              </AuthLabel>
              <View style={{ gap: 12 }}>
                {SELLER_TYPES.map((opt) => {
                  const isSelected = form.vendorType === opt.value
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => setForm((prev) => ({ ...prev, vendorType: opt.value }))}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isSelected }}
                      style={[
                        styles.typeCard,
                        isSelected
                          ? [{ borderColor: colors.brand[600], borderWidth: 2, padding: 13.5 - 1, backgroundColor: 'rgba(239,246,255,0.5)' }, shadows.xs]
                          : { borderColor: colors.slate[200], backgroundColor: '#fff' },
                      ]}
                    >
                      <View style={styles.typeHead}>
                        <Text style={[styles.typeTitle, { color: isSelected ? colors.slate[900] : colors.slate[700] }]}>{opt.title}</Text>
                        <View style={[styles.typeTag, { backgroundColor: isSelected ? colors.brand[600] : colors.slate[100] }]}>
                          <Text style={[styles.typeTagText, { color: isSelected ? '#fff' : colors.slate[500] }]}>{opt.tag.toUpperCase()}</Text>
                        </View>
                      </View>
                      <Text style={styles.typeDesc}>{opt.desc}</Text>
                    </Pressable>
                  )
                })}
              </View>
            </View>

            <View style={{ gap: 12, paddingTop: 4 }}>
              <AuthInput compact label="Full Name" required placeholder="e.g. Rahul Sharma" autoCapitalize="words" autoComplete="name" {...bind('name')} />
              <AuthInput
                compact
                label="Mobile Number"
                required
                placeholder="10-digit mobile number"
                keyboardType="phone-pad"
                maxLength={10}
                autoComplete="tel"
                {...bind('mobile')}
              />
              <AuthInput
                compact
                label="Email Address"
                required
                placeholder="seller@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                {...bind('email')}
              />
              <AuthInput
                compact
                secure
                label="Password"
                required
                placeholder="Min 6 characters"
                autoCapitalize="none"
                textContentType="newPassword"
                {...bind('password')}
              />
              <AuthInput
                compact
                secure
                label="Confirm Password"
                required
                placeholder="Re-enter password"
                autoCapitalize="none"
                textContentType="newPassword"
                {...bind('confirmPassword')}
              />
            </View>
          </View>
        )}

        {/* ================= STEP 2: BUSINESS & DOCUMENTS ================= */}
        {step === 2 && (
          <View style={{ gap: 16 }}>
            <View style={{ gap: 12 }}>
              <AuthInput
                compact
                label="Store / Business Name"
                required
                placeholder="e.g. Apex Wholesale Supplies"
                autoCapitalize="words"
                {...bind('businessName')}
              />

              <AuthSelect
                label="Business Structure"
                required={isB2B}
                placeholder="Select constitution type…"
                options={[{ value: '', label: 'Select constitution type…' }, ...BUSINESS_TYPES]}
                value={form.businessType}
                onChange={(v) => setValue('businessType', v)}
                error={errors.businessType}
              />

              <AuthInput
                compact
                mono
                label="PAN (Permanent Account Number)"
                required
                placeholder="ABCDE1234F"
                maxLength={10}
                autoCapitalize="characters"
                value={form.pan}
                onChangeText={(v) => setForm((p) => ({ ...p, pan: v.toUpperCase() }))}
              />

              <AuthSelect
                label="GST Registered?"
                required
                options={[
                  { value: 'false', label: 'No (Unregistered / Below 40L)' },
                  { value: 'true', label: 'Yes (Registered)' },
                ]}
                value={form.gstRegistered}
                onChange={(v) => setValue('gstRegistered', v)}
              />

              {form.gstRegistered === 'true' && (
                <AuthInput
                  compact
                  mono
                  bold
                  label="15-Digit GSTIN"
                  required
                  placeholder="27AAPFU0939F1ZV"
                  maxLength={15}
                  autoCapitalize="characters"
                  value={form.gstin}
                  error={errors.gstin}
                  onChangeText={(v) => setValue('gstin', v.toUpperCase())}
                />
              )}

              <AuthSelect
                label="Will you sell food products?"
                required
                options={[
                  { value: 'false', label: 'No, I will not sell food items' },
                  { value: 'true', label: 'Yes, I will sell food / grocery / beverages' },
                ]}
                value={form.sellsFood}
                onChange={(v) => setValue('sellsFood', v)}
                hint={
                  form.sellsFood === 'true'
                    ? 'An FSSAI licence is mandatory to sell food. Upload it below.'
                    : 'You can add an FSSAI licence later from Store Profile if you start selling food.'
                }
              />

              {form.sellsFood === 'true' && (
                <AuthInput
                  compact
                  mono
                  label="FSSAI Licence Number"
                  required
                  placeholder="14-digit licence number"
                  keyboardType="number-pad"
                  maxLength={14}
                  value={form.fssaiNumber}
                  error={errors.fssaiNumber}
                  onChangeText={(v) => setValue('fssaiNumber', v.replace(/\D/g, ''))}
                />
              )}
            </View>

            {/* DIRECT DOCUMENT UPLOAD SECTION */}
            <View style={styles.docsBox}>
              <View>
                <View style={styles.docsHead}>
                  <Icon name="HiOutlineDocumentCheck" size={16} color={colors.brand[600]} />
                  <Text style={styles.docsTitle}>Upload KYC Documents</Text>
                </View>
                <Text style={styles.docsDesc}>Attach your documents directly. Formats accepted: PDF, JPG, PNG (Max 10MB each).</Text>
              </View>

              <DocUpload
                label="1. PAN Card Document"
                required
                doc={docs.panDoc}
                error={errors.panDoc}
                uploadingText="Uploading PAN document…"
                chooseText="Choose PAN Card (Image or PDF)"
                onPick={() => handlePick('panDoc')}
                onRemove={() => setDocs((p) => ({ ...p, panDoc: null }))}
              />

              <DocUpload
                label="2. GST Certificate"
                required={form.gstRegistered === 'true'}
                optionalNote={form.gstRegistered !== 'true' ? ' (Optional for unregistered)' : null}
                doc={docs.gstDoc}
                error={errors.gstDoc}
                uploadingText="Uploading GST certificate…"
                chooseText="Choose GST Certificate (Image or PDF)"
                onPick={() => handlePick('gstDoc')}
                onRemove={() => setDocs((p) => ({ ...p, gstDoc: null }))}
              />

              {form.sellsFood === 'true' && (
                <DocUpload
                  label="3. FSSAI Licence"
                  required
                  doc={docs.fssaiDoc}
                  error={errors.fssaiDoc}
                  uploadingText="Uploading FSSAI licence…"
                  chooseText="Choose FSSAI Licence (Image or PDF)"
                  onPick={() => handlePick('fssaiDoc')}
                  onRemove={() => setDocs((p) => ({ ...p, fssaiDoc: null }))}
                />
              )}

              {form.sellsFood === 'true' && (
                <DocUpload
                  label="4. Food Test Certificate"
                  required
                  doc={docs.foodTestDoc}
                  error={errors.foodTestDoc}
                  uploadingText="Uploading certificate…"
                  chooseText="Choose Food Test Certificate (Image or PDF)"
                  onPick={() => handlePick('foodTestDoc')}
                  onRemove={() => setDocs((p) => ({ ...p, foodTestDoc: null }))}
                />
              )}
            </View>

            {/* B2B Authorised Contact Person */}
            {isB2B && (
              <View style={styles.contactBox}>
                <Text style={styles.contactTitle}>Authorised Contact Person</Text>
                <View style={{ gap: 10 }}>
                  <AuthInput
                    tight
                    label="Contact Name"
                    required
                    placeholder="Signatory name"
                    autoCapitalize="words"
                   
                    {...bind('contactName')}
                  />
                  <AuthInput
                    tight
                    label="Mobile"
                    required
                    placeholder="10-digit mobile"
                    keyboardType="phone-pad"
                    maxLength={10}
                    {...bind('contactMobile')}
                  />
                </View>
              </View>
            )}
          </View>
        )}

        {/* ================= STEP 3: PICKUP & PAYOUT ================= */}
        {step === 3 && (
          <View style={{ gap: 16 }}>
            <View style={{ gap: 8 }}>
              <Text style={styles.sectionTitle}>Warehouse Dispatch / Pickup Address</Text>
              <Text style={styles.sectionDesc}>Couriers collect packaged orders from this address.</Text>

              <View style={{ gap: 12, paddingTop: 4 }}>
                <AuthInput compact label="Address Line" required placeholder="Plot / Unit, Street, Area" {...bind('addressLine')} />
                <AuthInput compact label="City" required placeholder="City" autoCapitalize="words" {...bind('city')} />
                <AuthInput compact label="State" required placeholder="State" autoCapitalize="words" {...bind('state')} />
                <AuthInput
                  compact
                  mono
                  label="Pincode"
                  required
                  placeholder="6-digit pincode"
                  keyboardType="number-pad"
                  maxLength={6}
                  {...bind('pincode')}
                />
              </View>
            </View>

            <View style={styles.bankSection}>
              <Text style={styles.sectionTitle}>Bank Account for Payouts (Optional)</Text>
              <Text style={styles.sectionDesc}>
                Customer payments are collected centrally by Admin. Your earnings are deposited directly into this bank account (no payment gateway credentials required).
              </Text>

              <View style={{ gap: 12, paddingTop: 4 }}>
                <AuthInput compact label="Account Holder Name" placeholder="Bank registered name" autoCapitalize="words" {...bind('accountHolderName')} />
                <AuthInput compact label="Bank Name" placeholder="e.g. HDFC, ICICI, SBI" autoCapitalize="words" {...bind('bankName')} />
                <AuthInput
                  compact
                  mono
                  label="Account Number"
                  placeholder="Bank account number"
                  keyboardType="number-pad"
                  {...bind('accountNumber')}
                />
                <AuthInput
                  compact
                  mono
                  label="IFSC Code"
                  placeholder="e.g. HDFC0001234"
                  maxLength={11}
                  autoCapitalize="characters"
                  value={form.ifsc}
                  error={errors.ifsc}
                  onChangeText={(v) => setValue('ifsc', v.toUpperCase())}
                />
              </View>
            </View>
          </View>
        )}

        {step === 3 && (
          <View>
            <Pressable
              onPress={() => {
                // Ticking never checks the box directly: it opens the modal,
                // and only accepting every document there ticks it.
                if (policyAcceptances) setPolicyAcceptances(null)
                else setPolicyModalOpen(true)
              }}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: Boolean(policyAcceptances) }}
              style={styles.policyRow}
            >
              <View style={[styles.checkbox, policyAcceptances ? styles.checkboxOn : styles.checkboxOff]}>
                {policyAcceptances ? <Icon name="check" size={12} color="#fff" /> : null}
              </View>
              <Text style={styles.policyText}>
                {'I have read and agree to the Krozenda '}
                <Text style={styles.policyStrong}>Vendor Agreement, Terms &amp; Conditions, Privacy Policy, Shipping Policy and Return Policy</Text>
                {'.'}
                {policyAcceptances ? (
                  <Text noTranslate style={styles.policyAccepted}>
                    {`\nAccepted: ${policyAcceptances.map((p) => `${p.title} (${p.version})`).join(', ') || 'no policies required'}`}
                  </Text>
                ) : null}
              </Text>
            </Pressable>
            <AuthError small>{errors.policies}</AuthError>
          </View>
        )}

        {serverError ? (
          <View style={styles.serverError}>
            <Text style={styles.serverErrorText}>{serverError}</Text>
          </View>
        ) : null}

        {/* Buttons */}
        <View style={styles.footerRow}>
          {step > 1 ? (
            <AuthButton
              variant="outline"
              icon="HiOutlineArrowLeft"
              onPress={() => {
                setStep(step - 1)
                scrollTop()
              }}
            >
              Back
            </AuthButton>
          ) : (
            <View />
          )}

          {step < 3 ? (
            <AuthButton iconRight="HiOutlineArrowRight" px={20} onPress={goNext} style={shadows.xs}>
              Continue
            </AuthButton>
          ) : (
            <AuthButton px={20} onPress={handleSubmit} disabled={isSubmitting} style={shadows.xs}>
              {isSubmitting ? 'Submitting Application…' : 'Submit for Approval'}
            </AuthButton>
          )}
        </View>
      </View>

      {policyModalOpen && (
        <PolicyAcceptanceModal
          onClose={() => setPolicyModalOpen(false)}
          onAccepted={(list) => {
            setPolicyAcceptances(list)
            setPolicyModalOpen(false)
            setErrors((prev) => ({ ...prev, policies: undefined }))
          }}
        />
      )}

      <View style={styles.signInRow}>
        <Text style={styles.signInText}>Already selling on Krozenda? </Text>
        <Pressable onPress={() => router.replace(AUTH_ROUTES.LOGIN)} hitSlop={8}>
          <Text style={styles.signInLink}>Sign In</Text>
        </Pressable>
      </View>
    </VendorAuthShell>
  )
}

function guessMime(name = '') {
  const ext = String(name).split('.').pop().toLowerCase()
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  if (ext === 'png') return 'image/png'
  if (ext === 'webp') return 'image/webp'
  if (ext === 'pdf') return 'application/pdf'
  return ''
}

function SummaryRow({ label, value }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text noTranslate style={styles.summaryValue}>
        {value}
      </Text>
    </View>
  )
}

function DocUpload({ label, required, optionalNote, doc, error, uploadingText, chooseText, onPick, onRemove }) {
  return (
    <View>
      <Text style={styles.docLabel}>
        {label}
        {required ? (
          <Text noTranslate style={{ color: colors.danger[500] }}>
            {' *'}
          </Text>
        ) : null}
        {optionalNote ? <Text style={{ color: colors.slate[400], fontWeight: '400' }}>{optionalNote}</Text> : null}
      </Text>
      {doc?.url ? (
        <View style={styles.uploaded}>
          <View style={styles.uploadedLeft}>
            <Icon name="HiOutlineCheck" size={16} color={colors.success[600]} />
            <Text noTranslate numberOfLines={1} style={styles.uploadedName}>
              {doc.originalname}
            </Text>
            <Text style={styles.uploadedTag}>(UPLOADED ✓)</Text>
          </View>
          <Pressable onPress={onRemove} hitSlop={8} accessibilityLabel="Remove file" style={{ padding: 4 }}>
            <Icon name="HiOutlineTrash" size={16} color={colors.slate[400]} />
          </Pressable>
        </View>
      ) : (
        <Pressable onPress={onPick} disabled={doc?.uploading} accessibilityRole="button" style={[styles.chooser, doc?.uploading && { opacity: 0.7 }]}>
          <Icon name="HiOutlineDocumentArrowUp" size={20} color={colors.slate[400]} />
          <Text style={styles.chooserText}>{doc?.uploading ? uploadingText : chooseText}</Text>
        </Pressable>
      )}
      {error ? <Text style={styles.docError}>{error}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  stepItem: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  stepCircle: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  stepNum: { fontSize: 12, lineHeight: 16, fontWeight: '700' },
  stepLine: { flex: 1, height: 2, marginHorizontal: 8 },

  typeCard: { padding: 14, borderRadius: 12, borderWidth: 1 },
  typeHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  typeTitle: { flexShrink: 1, fontSize: 12, lineHeight: 16, fontWeight: '700' },
  typeTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  typeTagText: { fontSize: 9, lineHeight: 12, fontWeight: '800' },
  typeDesc: { marginTop: 4, fontSize: 11, lineHeight: 15, color: colors.slate[500] },

  docsBox: { padding: 16, borderRadius: 16, backgroundColor: colors.slate[50], borderWidth: 1, borderColor: colors.slate[200], gap: 14, marginTop: 8 },
  docsHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  docsTitle: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: colors.slate[900] },
  docsDesc: { marginTop: 2, fontSize: 11, lineHeight: 16, color: colors.slate[500] },
  docLabel: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.slate[700], marginBottom: 4 },
  docError: { marginTop: 4, fontSize: 11, lineHeight: 16, fontWeight: '500', color: colors.danger[500] },
  uploaded: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    backgroundColor: colors.success[50],
    borderWidth: 1,
    borderColor: colors.success[200],
    borderRadius: 12,
    gap: 8,
  },
  uploadedLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  uploadedName: { flexShrink: 1, fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.success[800] },
  uploadedTag: { fontSize: 10, lineHeight: 16, fontWeight: '700', color: colors.success[600] },
  chooser: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.slate[300],
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
  },
  chooserText: { flexShrink: 1, fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.slate[600] },

  contactBox: { padding: 14, borderRadius: 12, backgroundColor: colors.slate[50], borderWidth: 1, borderColor: colors.slate[200], gap: 10, marginTop: 4 },
  contactTitle: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: colors.slate[800] },

  sectionTitle: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: colors.slate[900] },
  sectionDesc: { fontSize: 11, lineHeight: 16, color: colors.slate[500] },
  bankSection: { gap: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.slate[100] },

  policyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.slate[200],
    backgroundColor: 'rgba(248,250,252,0.7)',
  },
  checkbox: { width: 16, height: 16, borderRadius: 4, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  checkboxOn: { backgroundColor: colors.brand[600], borderColor: colors.brand[600] },
  checkboxOff: { backgroundColor: '#fff', borderColor: colors.slate[300] },
  policyText: { flex: 1, fontSize: 12, lineHeight: 19.5, color: colors.slate[600] },
  policyStrong: { fontWeight: '600', color: colors.slate[900] },
  policyAccepted: { fontWeight: '600', color: colors.success[600] },

  serverError: { padding: 12, borderRadius: 12, backgroundColor: colors.danger[50], borderWidth: 1, borderColor: colors.danger[200] },
  serverErrorText: { fontSize: 12, lineHeight: 16, color: colors.danger[700] },

  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.slate[100],
  },
  signInRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', paddingTop: 12 },
  signInText: { fontSize: 12, lineHeight: 16, color: colors.slate[500] },
  signInLink: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: colors.brand[600] },

  successIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.success[50],
    borderWidth: 1,
    borderColor: colors.success[200],
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: { fontSize: 16, lineHeight: 24, fontWeight: '700', color: colors.slate[900], textAlign: 'center' },
  successDesc: { marginTop: 4, fontSize: 12, lineHeight: 19.5, color: colors.slate[500], textAlign: 'center' },
  successNote: { paddingTop: 4, fontSize: 11, lineHeight: 16, color: colors.slate[500], textAlign: 'center' },
  summary: { alignSelf: 'stretch', padding: 16, backgroundColor: colors.slate[50], borderWidth: 1, borderColor: 'rgba(226,232,240,0.9)', borderRadius: 16, gap: 8 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  summaryLast: { paddingTop: 4, borderTopWidth: 1, borderTopColor: 'rgba(226,232,240,0.6)' },
  summaryLabel: { fontSize: 12, lineHeight: 16, color: colors.slate[600] },
  summaryValue: { flexShrink: 1, fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.slate[900], textAlign: 'right' },
  pending: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: colors.warning[50], borderWidth: 1, borderColor: colors.warning[200] },
  pendingText: { fontSize: 11, lineHeight: 16, fontWeight: '700', color: colors.warning[700] },
})
