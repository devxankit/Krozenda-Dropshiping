import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Avatar,
  Badge,
  Button,
  Icon,
  Input,
  PasswordInput,
  Switch,
} from '../../../../components/ui'
import { FormSection } from '../../components/forms'
import { InlineAlert } from '../../components/feedback'
import { SectionCard } from '../../components/display'
import { SettingsShell } from '../../components/system/SettingsShell'
import { useAuthStore } from '../../../../lib/authStore'
import { useGeneralSettingsController } from '../../controllers/useSystemController'
import {
  changeAdminPassword,
  updateAdminProfile,
  updateGeneralSettings,
} from '../../services/systemService'
import { usePaymentSettingsController } from '../../controllers/usePaymentSettingsController'
import { toast } from '../../../../lib/toast'

const SETTINGS_TABS = [
  { id: 'general', label: 'General & Profile', icon: 'settings' },
  { id: 'payments', label: 'Payment Methods', icon: 'settlements' },
  { id: 'footer', label: 'Footer & Social Links', icon: 'layout' },
  { id: 'security', label: 'Security & Password', icon: 'lock' },
  { id: 'commission_gst', label: 'Commission & GST', icon: 'currency' },
]

const CURRENT_YEAR = new Date().getFullYear()

export function GeneralSettingsPage({ defaultTab }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') || defaultTab || 'general'

  const user = useAuthStore((state) => state.user)
  const setUser = useAuthStore((state) => state.setUser)

  const controller = useGeneralSettingsController()
  const paymentController = usePaymentSettingsController()
  const fileInputRef = useRef(null)

  // Tab 1 state: Profile & Store details
  const [adminName, setAdminName] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPhone, setAdminPhone] = useState('')
  const [previewSrc, setPreviewSrc] = useState(null)
  const [imageFile, setImageFile] = useState(null)
  const [removeAvatar, setRemoveAvatar] = useState(false)

  const [platformName, setPlatformName] = useState('')
  const [legalEntity, setLegalEntity] = useState('')
  const [gstin, setGstin] = useState('')
  // Printed as the supplier address on Krozenda's invoices (own stock, CJ);
  // its state decides CGST + SGST vs IGST.
  const [registeredAddress, setRegisteredAddress] = useState(null)
  const [supportEmail, setSupportEmail] = useState('')
  const [supportPhone, setSupportPhone] = useState('')

  const [isSavingGeneral, setIsSavingGeneral] = useState(false)
  const [generalFeedback, setGeneralFeedback] = useState(null)

  // Footer & Social Links state
  const [footerTagline, setFooterTagline] = useState('')
  const [copyrightText, setCopyrightText] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [instagram, setInstagram] = useState('')
  const [linkedin, setLinkedin] = useState('')
  const [twitter, setTwitter] = useState('')
  const [youtube, setYoutube] = useState('')
  const [facebook, setFacebook] = useState('')
  const [quickLinks, setQuickLinks] = useState([
    { label: 'All Categories', path: '/app/categories' },
    { label: 'Trending Deals', path: '/app/dashboard' },
    { label: 'Electronics & Audio', path: '/app/listing?category=electronics' },
    { label: 'Fashion & Lifestyle', path: '/app/listing?category=fashion' },
  ])
  const [customerLinks, setCustomerLinks] = useState([
    { label: 'Help & Support', path: '/app/support' },
    { label: 'Track Order', path: '/app/orders' },
    { label: 'Return Policy', path: '/return-policy' },
    { label: 'Shipping Timelines', path: '/shipping-policy' },
  ])
  const [legalLinks, setLegalLinks] = useState([
    { label: 'About Us', path: '/about' },
    { label: 'Terms & Conditions', path: '/terms' },
    { label: 'Privacy Policy', path: '/privacy-policy' },
    { label: 'Sell on KroZenda', path: '/seller/login' },
  ])
  const [isSavingFooter, setIsSavingFooter] = useState(false)
  const [footerFeedback, setFooterFeedback] = useState(null)

  // Tab 3 state: Security & Password
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false)
  const [passwordFeedback, setPasswordFeedback] = useState(null)

  // Tab 4 state: Commission & GST
  const [commissionRate, setCommissionRate] = useState(10)
  const [commissionType, setCommissionType] = useState('percentage')
  const [gstRate, setGstRate] = useState(18)
  const [gstType, setGstType] = useState('percentage')
  const [isSavingFinance, setIsSavingFinance] = useState(false)
  const [financeFeedback, setFinanceFeedback] = useState(null)

  // Initialize fields once data / user loads
  useEffect(() => {
    if (user) {
      setAdminName((prev) => prev || user.name || '')
      setAdminEmail((prev) => prev || user.email || '')
      setAdminPhone((prev) => prev || user.mobileNumber || '')
      if (user.image && !previewSrc && !removeAvatar) {
        setPreviewSrc(user.image)
      }
    }
  }, [user])

  useEffect(() => {
    if (controller.data?.platform) {
      const p = controller.data.platform
      setPlatformName((prev) => prev || p.name || '')
      setLegalEntity((prev) => prev || p.legalEntity || '')
      setGstin((prev) => prev || p.gstin || '')
      setRegisteredAddress((prev) => prev || { addressLine: '', city: '', state: '', pincode: '', ...p.registeredAddress })
      setSupportEmail((prev) => prev || p.supportEmail || '')
      setSupportPhone((prev) => prev || p.supportPhone || '')
      if (p.footerTagline !== undefined) setFooterTagline((prev) => prev || p.footerTagline)
      if (p.copyrightText !== undefined) setCopyrightText((prev) => prev || p.copyrightText)
      if (p.socialLinks) {
        setWhatsapp((prev) => prev || p.socialLinks.whatsapp || '')
        setInstagram((prev) => prev || p.socialLinks.instagram || '')
        setLinkedin((prev) => prev || p.socialLinks.linkedin || '')
        setTwitter((prev) => prev || p.socialLinks.twitter || '')
        setYoutube((prev) => prev || p.socialLinks.youtube || '')
        setFacebook((prev) => prev || p.socialLinks.facebook || '')
      }
      if (p.quickLinks && p.quickLinks.length) setQuickLinks(p.quickLinks)
      if (p.customerLinks && p.customerLinks.length) setCustomerLinks(p.customerLinks)
      if (p.legalLinks && p.legalLinks.length) setLegalLinks(p.legalLinks)
      if (p.commissionRate !== undefined) {
        setCommissionRate(p.commissionRate)
      } else if (p.defaultCommissionPercent !== undefined) {
        setCommissionRate(p.defaultCommissionPercent)
      }
      if (p.commissionType) {
        setCommissionType(p.commissionType)
      }
      if (p.gstRate !== undefined) {
        setGstRate(p.gstRate)
      } else if (p.defaultGstRate !== undefined) {
        setGstRate(p.defaultGstRate)
      }
      if (p.gstType) {
        setGstType(p.gstType)
      }
    }
  }, [controller.data])

  const handleTabChange = (tabId) => {
    setSearchParams({ tab: tabId })
    setGeneralFeedback(null)
    setFooterFeedback(null)
    setPasswordFeedback(null)
    setFinanceFeedback(null)
  }

  // Handle Photo pick
  const handlePhotoSelect = (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      setGeneralFeedback({ tone: 'danger', message: 'Image size must be smaller than 5MB' })
      return
    }

    setImageFile(file)
    setRemoveAvatar(false)
    const objectUrl = URL.createObjectURL(file)
    setPreviewSrc(objectUrl)
  }

  const handleRemovePhoto = () => {
    setImageFile(null)
    setRemoveAvatar(true)
    setPreviewSrc(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Save Tab 1: General & Profile
  const handleSaveGeneral = async (e) => {
    e?.preventDefault?.()
    setIsSavingGeneral(true)
    setGeneralFeedback(null)

    try {
      // 1. Update Admin Profile
      const formData = new FormData()
      formData.append('name', adminName)
      formData.append('email', adminEmail)
      formData.append('mobileNumber', adminPhone)

      if (imageFile) {
        formData.append('image', imageFile)
      } else if (removeAvatar) {
        formData.append('image', '')
      }

      const updatedAdmin = await updateAdminProfile(formData)

      // Refresh auth store user data for instant topbar update
      if (updatedAdmin?.admin) {
        setUser({
          ...user,
          name: updatedAdmin.admin.name,
          email: updatedAdmin.admin.email,
          image: updatedAdmin.admin.image,
          mobileNumber: updatedAdmin.admin.mobileNumber,
        })
      }

      // 2. Update Platform Settings
      await updateGeneralSettings({
        name: platformName,
        legalEntity,
        gstin,
        ...(registeredAddress ? { registeredAddress } : {}),
        supportEmail,
        supportPhone,
        footerTagline,
        copyrightText,
        socialLinks: {
          whatsapp,
          instagram,
          linkedin,
          twitter,
          youtube,
          facebook,
        },
        quickLinks,
        customerLinks,
        legalLinks,
      })

      controller.refetch?.()
      setGeneralFeedback({ tone: 'success', message: 'Profile and store details saved successfully!' })
      toast.success('Settings Saved', 'Profile and store details saved successfully.')
    } catch (err) {
      const msg = err?.response?.data?.message || err.message || 'Failed to save general settings'
      setGeneralFeedback({
        tone: 'danger',
        message: msg,
      })
      toast.error('Could not save settings', msg)
    } finally {
      setIsSavingGeneral(false)
    }
  }

  // Save Footer & Social Media Links
  const handleSaveFooter = async (e) => {
    e?.preventDefault?.()
    setIsSavingFooter(true)
    setFooterFeedback(null)

    try {
      await updateGeneralSettings({
        name: platformName,
        legalEntity,
        gstin,
        ...(registeredAddress ? { registeredAddress } : {}),
        supportEmail,
        supportPhone,
        footerTagline,
        copyrightText,
        socialLinks: {
          whatsapp,
          instagram,
          linkedin,
          twitter,
          youtube,
          facebook,
        },
        quickLinks,
        customerLinks,
        legalLinks,
      })

      controller.refetch?.()
      setFooterFeedback({ tone: 'success', message: 'Footer, contact and social links saved successfully!' })
      toast.success('Footer Saved', 'Footer, contact and social links saved successfully.')
    } catch (err) {
      const msg = err?.response?.data?.message || err.message || 'Failed to save footer settings'
      setFooterFeedback({
        tone: 'danger',
        message: msg,
      })
      toast.error('Could not save footer', msg)
    } finally {
      setIsSavingFooter(false)
    }
  }

  // Save Tab 2: Security & Password
  const handleUpdatePassword = async (e) => {
    e?.preventDefault?.()
    if (!newPassword) return

    if (newPassword.length < 6) {
      setPasswordFeedback({ tone: 'danger', message: 'New password must be at least 6 characters long' })
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordFeedback({ tone: 'danger', message: 'New password and confirm password do not match' })
      return
    }

    setIsUpdatingPassword(true)
    setPasswordFeedback(null)

    try {
      await changeAdminPassword({
        currentPassword,
        newPassword,
        confirmPassword,
      })

      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordFeedback({ tone: 'success', message: 'Password updated successfully! Keep your credentials safe.' })
      toast.success('Password Updated', 'Your admin password was updated successfully.')
    } catch (err) {
      const msg = err?.response?.data?.message || err.message || 'Failed to update password'
      setPasswordFeedback({
        tone: 'danger',
        message: msg,
      })
      toast.error('Could not update password', msg)
    } finally {
      setIsUpdatingPassword(false)
    }
  }

  // Save Tab 3: Commission & GST
  const handleSaveFinance = async (e) => {
    e?.preventDefault?.()
    setIsSavingFinance(true)
    setFinanceFeedback(null)

    try {
      await updateGeneralSettings({
        commissionRate: Number(commissionRate),
        commissionType,
        gstRate: Number(gstRate),
        gstType,
        defaultCommissionPercent: commissionType === 'percentage' ? Number(commissionRate) : undefined,
        defaultGstRate: gstType === 'percentage' ? Number(gstRate) : undefined,
      })

      controller.refetch?.()
      setFinanceFeedback({ tone: 'success', message: 'Commission and GST settings saved successfully!' })
      toast.success('Finance Settings Saved', 'Commission and GST rates updated.')
    } catch (err) {
      const msg = err?.response?.data?.message || err.message || 'Failed to save commission & GST settings'
      setFinanceFeedback({
        tone: 'danger',
        message: msg,
      })
      toast.error('Could not save finance settings', msg)
    } finally {
      setIsSavingFinance(false)
    }
  }

  return (
    <SettingsShell
      title="Settings"
      description="Manage account details, login security, support contacts, commission rates and GST rules."
      controller={controller}
      hideNav
    >
      {() => (
        <div className="flex flex-col gap-5">
          {/* Top Horizontal Navigation Tabs */}
          <div className="flex items-center border-b border-border bg-surface px-1">
            {SETTINGS_TABS.map((tab) => {
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleTabChange(tab.id)}
                  className={`relative flex items-center gap-2 border-b-2 px-5 py-3 text-xs font-semibold transition-all ${
                    isActive
                      ? 'border-brand-600 text-brand-700 font-bold'
                      : 'border-transparent text-ink-muted hover:border-border hover:text-slate-900'
                  }`}
                >
                  <Icon name={tab.icon} className={`h-4 w-4 ${isActive ? 'text-brand-600' : 'text-ink-faint'}`} />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </div>

          {/* ================================================================= */}
          {/* TAB 1: GENERAL & PROFILE                                          */}
          {/* ================================================================= */}
          {activeTab === 'general' && (
            <form onSubmit={handleSaveGeneral} className="flex flex-col gap-5">
              {generalFeedback && (
                <InlineAlert tone={generalFeedback.tone} title={generalFeedback.tone === 'success' ? 'Saved' : 'Error'}>
                  {generalFeedback.message}
                </InlineAlert>
              )}

              {/* Profile & Avatar Section */}
              <SectionCard
                title="Profile & Avatar"
                description="Your account information and photo visible in the administrative workspace"
              >
                <div className="p-4 sm:p-5">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 pb-5 border-b border-border-subtle">
                    <Avatar
                      name={adminName || user?.name || 'Admin'}
                      src={previewSrc}
                      size="xl"
                      tone="inverted"
                      className="ring-4 ring-slate-100 shadow-md"
                    />

                    <div className="flex flex-col gap-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          icon="camera"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          {previewSrc ? 'Change photo' : 'Upload photo'}
                        </Button>

                        {previewSrc && (
                          <Button
                            type="button"
                            variant="dangerOutline"
                            size="sm"
                            icon="trash"
                            onClick={handleRemovePhoto}
                          >
                            Remove
                          </Button>
                        )}
                      </div>

                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handlePhotoSelect}
                      />
                      <p className="text-2xs text-ink-faint">
                        PNG, JPG, or WebP up to 5MB. Square photo recommended.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-5">
                    <Input
                      id="admin-name"
                      label="Your name"
                      size="control"
                      value={adminName}
                      onChange={(e) => setAdminName(e.target.value)}
                      placeholder="e.g. Priya Sharma"
                      required
                    />

                    <Input
                      id="admin-email"
                      label="Login email"
                      type="email"
                      size="control"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      placeholder="admin@krozenda.in"
                      required
                    />

                    <Input
                      id="admin-phone"
                      label="Phone number"
                      size="control"
                      value={adminPhone}
                      onChange={(e) => setAdminPhone(e.target.value)}
                      placeholder="+91 98204 11276"
                    />
                  </div>
                </div>
              </SectionCard>

              {/* Platform & Store Details */}
              <FormSection
                title="Store & Support Identity"
                description="Shown on buyer invoices, tax receipts, and transactional communication"
              >
                <Input
                  id="platform-name"
                  label="Platform name"
                  size="control"
                  value={platformName}
                  onChange={(e) => setPlatformName(e.target.value)}
                  placeholder="Krozenda"
                />

                <Input
                  id="legal-entity"
                  label="Legal entity"
                  size="control"
                  value={legalEntity}
                  onChange={(e) => setLegalEntity(e.target.value)}
                  placeholder="Krozenda Commerce Private Limited"
                />

                <Input
                  id="gstin-input"
                  label="GSTIN"
                  size="control"
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value.toUpperCase())}
                  placeholder="27AAECK4821M1Z9"
                  description="15-digit Goods & Services Tax Identification Number. Printed on invoices for own-stock and CJ Dropshipping items; seller items carry the seller's own GSTIN."
                />

                <Input
                  id="registered-address-line"
                  label="GST registered address"
                  size="control"
                  value={registeredAddress?.addressLine || ''}
                  onChange={(e) => setRegisteredAddress((prev) => ({ ...prev, addressLine: e.target.value }))}
                  placeholder="Building, street, area"
                />

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <Input
                    id="registered-address-city"
                    label="City"
                    size="control"
                    value={registeredAddress?.city || ''}
                    onChange={(e) => setRegisteredAddress((prev) => ({ ...prev, city: e.target.value }))}
                  />
                  <Input
                    id="registered-address-state"
                    label="State"
                    size="control"
                    value={registeredAddress?.state || ''}
                    onChange={(e) => setRegisteredAddress((prev) => ({ ...prev, state: e.target.value }))}
                    description="Decides CGST + SGST or IGST"
                  />
                  <Input
                    id="registered-address-pincode"
                    label="Pincode"
                    size="control"
                    value={registeredAddress?.pincode || ''}
                    onChange={(e) => setRegisteredAddress((prev) => ({ ...prev, pincode: e.target.value }))}
                  />
                </div>

                <Input
                  id="support-email"
                  label="Support email"
                  type="email"
                  size="control"
                  value={supportEmail}
                  onChange={(e) => setSupportEmail(e.target.value)}
                  placeholder="help@krozenda.in"
                />

                <Input
                  id="support-phone"
                  label="Support phone"
                  size="control"
                  value={supportPhone}
                  onChange={(e) => setSupportPhone(e.target.value)}
                  placeholder="+91 22 6820 4400"
                />

                <Input
                  id="platform-timezone"
                  label="Timezone"
                  size="control"
                  value="Asia/Kolkata (IST, UTC+5:30)"
                  disabled
                />
              </FormSection>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button type="submit" size="control" isLoading={isSavingGeneral}>
                  Save changes
                </Button>
              </div>
            </form>
          )}

          {/* ================================================================= */}
          {/* TAB: FOOTER & SOCIAL LINKS                                        */}
          {/* ================================================================= */}
          {activeTab === 'footer' && (
            <form onSubmit={handleSaveFooter} className="flex flex-col gap-5">
              {footerFeedback && (
                <InlineAlert tone={footerFeedback.tone} title={footerFeedback.tone === 'success' ? 'Saved' : 'Error'}>
                  {footerFeedback.message}
                </InlineAlert>
              )}

              {/* Support & Contact channels */}
              <SectionCard
                title="Customer Support & Contact Info"
                description="Phone number and email displayed on the website footer and customer communications"
              >
                <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    id="footer-support-phone"
                    label="Customer Support Phone / Helpline"
                    size="control"
                    value={supportPhone}
                    onChange={(e) => setSupportPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    description="Displayed next to the phone icon in the website footer"
                  />

                  <Input
                    id="footer-support-email"
                    label="Customer Support Email"
                    type="email"
                    size="control"
                    value={supportEmail}
                    onChange={(e) => setSupportEmail(e.target.value)}
                    placeholder="support@krozenda.com"
                    description="Displayed next to the email icon in the website footer"
                  />

                  <div className="md:col-span-2">
                    <Input
                      id="footer-tagline"
                      label="Footer Tagline / Bio"
                      size="control"
                      value={footerTagline}
                      onChange={(e) => setFooterTagline(e.target.value)}
                      placeholder="B2B wholesale and dropshipping marketplace connecting retailers with direct factory prices."
                      description="Short 1-2 sentence description shown directly below the logo in the footer"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <Input
                      id="footer-copyright"
                      label="Copyright Notice"
                      size="control"
                      value={copyrightText}
                      onChange={(e) => setCopyrightText(e.target.value)}
                      placeholder={`© ${CURRENT_YEAR} KroZenda Technologies Pvt Ltd. All rights reserved.`}
                      description="Displayed at the bottom-left of the footer sub-bar"
                    />
                  </div>
                </div>
              </SectionCard>

              {/* Social Media Links */}
              <SectionCard
                title="Social Media Links"
                description="Configure official social media URLs. Leave empty to hide any icon."
              >
                <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    id="social-whatsapp"
                    label="WhatsApp Community / Chat URL"
                    size="control"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    placeholder="https://wa.me/919876543210 or https://chat.whatsapp.com/..."
                  />

                  <Input
                    id="social-instagram"
                    label="Instagram URL"
                    size="control"
                    value={instagram}
                    onChange={(e) => setInstagram(e.target.value)}
                    placeholder="https://instagram.com/krozenda"
                  />

                  <Input
                    id="social-linkedin"
                    label="LinkedIn URL"
                    size="control"
                    value={linkedin}
                    onChange={(e) => setLinkedin(e.target.value)}
                    placeholder="https://linkedin.com/company/krozenda"
                  />

                  <Input
                    id="social-twitter"
                    label="X (Twitter) URL"
                    size="control"
                    value={twitter}
                    onChange={(e) => setTwitter(e.target.value)}
                    placeholder="https://twitter.com/krozenda"
                  />

                  <Input
                    id="social-youtube"
                    label="YouTube Channel URL"
                    size="control"
                    value={youtube}
                    onChange={(e) => setYoutube(e.target.value)}
                    placeholder="https://youtube.com/@krozenda"
                  />

                  <Input
                    id="social-facebook"
                    label="Facebook Page URL"
                    size="control"
                    value={facebook}
                    onChange={(e) => setFacebook(e.target.value)}
                    placeholder="https://facebook.com/krozenda"
                  />
                </div>
              </SectionCard>

              {/* Dynamic Footer Link Columns */}
           
              <div className="flex items-center justify-end gap-3 pt-2">
                <Button type="submit" size="control" isLoading={isSavingFooter}>
                  Save Footer Settings
                </Button>
              </div>
            </form>
          )}

          {/* ================================================================= */}
          {/* TAB 2: SECURITY & PASSWORD                                        */}
          {/* ================================================================= */}
          {activeTab === 'security' && (
            <form onSubmit={handleUpdatePassword} className="flex flex-col gap-5">
              {passwordFeedback && (
                <InlineAlert tone={passwordFeedback.tone} title={passwordFeedback.tone === 'success' ? 'Updated' : 'Error'}>
                  {passwordFeedback.message}
                </InlineAlert>
              )}

              <SectionCard
                title="Change Password"
                description="Ensure your administrator account has a strong and unique password"
              >
                <div className="p-4 sm:p-5 flex flex-col gap-4 max-w-xl">
                  <PasswordInput
                    id="current-password"
                    label="Current password"
                    size="control"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    description="Leave blank if you have not set a previous password"
                  />

                  <PasswordInput
                    id="new-password"
                    label="New password"
                    size="control"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    required
                  />

                  <PasswordInput
                    id="confirm-password"
                    label="Confirm new password"
                    size="control"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    required
                  />

                  {/* Password helper indicators */}
                  <div className="flex flex-col gap-1.5 rounded-md bg-surface-muted/60 p-3 text-xs">
                    <div className="flex items-center gap-2">
                      <span className={newPassword.length >= 6 ? 'text-emerald-600 font-bold' : 'text-ink-faint'}>
                        {newPassword.length >= 6 ? '✓' : '•'}
                      </span>
                      <span className={newPassword.length >= 6 ? 'text-slate-800' : 'text-ink-muted'}>
                        At least 6 characters
                      </span>
                    </div>

                    {confirmPassword && (
                      <div className="flex items-center gap-2">
                        <span className={newPassword === confirmPassword ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                          {newPassword === confirmPassword ? '✓' : '✗'}
                        </span>
                        <span className={newPassword === confirmPassword ? 'text-emerald-700 font-medium' : 'text-rose-600 font-medium'}>
                          {newPassword === confirmPassword ? 'Passwords match' : 'Passwords do not match'}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="pt-2">
                    <Button
                      type="submit"
                      size="control"
                      isLoading={isUpdatingPassword}
                      disabled={!newPassword || newPassword.length < 6 || newPassword !== confirmPassword}
                    >
                      Update password
                    </Button>
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                title="Account Protection"
                description="Administrative policy and session safety"
              >
                <div className="divide-y divide-border-subtle text-xs">
                  <div className="flex items-center justify-between p-4">
                    <div>
                      <p className="font-semibold text-slate-900">Two-Factor Authentication</p>
                      <p className="text-ink-faint text-2xs">Requires OTP verification on every sensitive action</p>
                    </div>
                    <Badge tone="success" size="sm" dot>Enforced</Badge>
                  </div>

                  <div className="flex items-center justify-between p-4">
                    <div>
                      <p className="font-semibold text-slate-900">Session Inactivity Lock</p>
                      <p className="text-ink-faint text-2xs">Automatic logout after 12 hours of inactivity</p>
                    </div>
                    <Badge tone="neutral" size="sm">12 Hours</Badge>
                  </div>
                </div>
              </SectionCard>
            </form>
          )}

          {/* ================================================================= */}
          {/* TAB 3: COMMISSION & GST                                           */}
          {/* ================================================================= */}
          {activeTab === 'commission_gst' && (
            <form onSubmit={handleSaveFinance} className="flex flex-col gap-5">
              {financeFeedback && (
                <InlineAlert tone={financeFeedback.tone} title={financeFeedback.tone === 'success' ? 'Saved' : 'Error'}>
                  {financeFeedback.message}
                </InlineAlert>
              )}

              <SectionCard
                title="Commission & GST"
                description="Configure platform commission rate and GST as flat amount or percentage"
              >
                <div className="p-4 sm:p-6 flex flex-col gap-6 max-w-xl">
                  {/* 1. Commission Rate Input with Flat vs Percentage toggle */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <label htmlFor="commission-rate" className="text-sm font-semibold text-slate-800">
                        Commission Rate
                      </label>
                      <div className="inline-flex rounded-md border border-border bg-surface-muted/60 p-0.5 text-xs">
                        <button
                          type="button"
                          onClick={() => setCommissionType('percentage')}
                          className={`rounded px-3 py-1 font-medium transition-all ${
                            commissionType === 'percentage'
                              ? 'bg-surface text-brand-700 font-semibold shadow-sm'
                              : 'text-ink-muted hover:text-slate-900'
                          }`}
                        >
                          Percentage (%)
                        </button>
                        <button
                          type="button"
                          onClick={() => setCommissionType('flat')}
                          className={`rounded px-3 py-1 font-medium transition-all ${
                            commissionType === 'flat'
                              ? 'bg-surface text-brand-700 font-semibold shadow-sm'
                              : 'text-ink-muted hover:text-slate-900'
                          }`}
                        >
                          Flat (₹)
                        </button>
                      </div>
                    </div>
                    <Input
                      id="commission-rate"
                      type="number"
                      min="0"
                      step={commissionType === 'percentage' ? '0.1' : '1'}
                      suffix={commissionType === 'percentage' ? '%' : '₹'}
                      size="control"
                      value={commissionRate}
                      onChange={(e) => setCommissionRate(e.target.value)}
                      placeholder={commissionType === 'percentage' ? 'e.g. 10' : 'e.g. 50'}
                      required
                    />
                  </div>

                  {/* 2. GST Input with Flat vs Percentage toggle */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <label htmlFor="gst-rate" className="text-sm font-semibold text-slate-800">
                        GST
                      </label>
                      <div className="inline-flex rounded-md border border-border bg-surface-muted/60 p-0.5 text-xs">
                        <button
                          type="button"
                          onClick={() => setGstType('percentage')}
                          className={`rounded px-3 py-1 font-medium transition-all ${
                            gstType === 'percentage'
                              ? 'bg-surface text-brand-700 font-semibold shadow-sm'
                              : 'text-ink-muted hover:text-slate-900'
                          }`}
                        >
                          Percentage (%)
                        </button>
                        <button
                          type="button"
                          onClick={() => setGstType('flat')}
                          className={`rounded px-3 py-1 font-medium transition-all ${
                            gstType === 'flat'
                              ? 'bg-surface text-brand-700 font-semibold shadow-sm'
                              : 'text-ink-muted hover:text-slate-900'
                          }`}
                        >
                          Flat (₹)
                        </button>
                      </div>
                    </div>
                    <Input
                      id="gst-rate"
                      type="number"
                      min="0"
                      step={gstType === 'percentage' ? '0.1' : '1'}
                      suffix={gstType === 'percentage' ? '%' : '₹'}
                      size="control"
                      value={gstRate}
                      onChange={(e) => setGstRate(e.target.value)}
                      placeholder={gstType === 'percentage' ? 'e.g. 18' : 'e.g. 40'}
                      required
                    />
                  </div>

                  <div className="pt-2">
                    <Button type="submit" size="control" isLoading={isSavingFinance}>
                      Save settings
                    </Button>
                  </div>
                </div>
              </SectionCard>
            </form>
          )}

          {/* ================================================================= */}
          {/* TAB: PAYMENT METHODS                                              */}
          {/* ================================================================= */}
          {activeTab === 'payments' && (
            <div className="flex flex-col gap-5">
              {paymentController.saveSuccess && (
                <InlineAlert tone="success" title="Payment settings saved">
                  Payment method availability updated successfully and is live on checkout.
                </InlineAlert>
              )}

              {paymentController.saveError && (
                <InlineAlert tone="danger" title="Could not save">
                  {paymentController.saveError?.message || 'The change was rejected.'}
                </InlineAlert>
              )}

              <SectionCard
                title="Payment Methods"
                description="Toggle payment methods ON or OFF. At least one must stay on, or buyers cannot check out."
              >
                <div className="p-4 sm:p-5 flex flex-col gap-4">
                  {paymentController.isLoading ? (
                    <div className="py-8 text-center text-xs text-ink-muted">Loading payment settings...</div>
                  ) : paymentController.settings ? (
                    <>
                      <div className="flex flex-col divide-y divide-border rounded-xl border border-border bg-surface">
                        {/* 1. Cash on Delivery (COD) */}
                        <div className="flex items-center justify-between p-4 transition-colors hover:bg-surface-muted/40">
                          <div className="flex flex-col gap-1 pr-4">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-slate-900">Cash on Delivery (COD)</span>
                              <Badge tone={paymentController.settings.codEnabled ? 'success' : 'neutral'}>
                                {paymentController.settings.codEnabled ? 'Active' : 'Disabled'}
                              </Badge>
                            </div>
                            <span className="text-xs text-ink-muted">
                              Buyer pays the courier in cash when parcel arrives at delivery destination.
                            </span>
                          </div>
                          <Switch
                            id="codEnabled"
                            checked={paymentController.settings.codEnabled}
                            onChange={(e) => paymentController.update('codEnabled', e.target.checked)}
                          />
                        </div>

                        {/* 2. Online Payment (Razorpay) */}
                        <div className="flex items-center justify-between p-4 transition-colors hover:bg-surface-muted/40">
                          <div className="flex flex-col gap-1 pr-4">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-slate-900">Online Payment (Razorpay)</span>
                              <Badge tone={paymentController.settings.razorpayEnabled ? 'success' : 'neutral'}>
                                {paymentController.settings.razorpayEnabled ? 'Active' : 'Disabled'}
                              </Badge>
                            </div>
                            <span className="text-xs text-ink-muted">
                              UPI, Credit/Debit Cards, NetBanking, and Wallets via Razorpay gateway.
                            </span>
                          </div>
                          <Switch
                            id="razorpayEnabled"
                            checked={paymentController.settings.razorpayEnabled}
                            onChange={(e) => paymentController.update('razorpayEnabled', e.target.checked)}
                          />
                        </div>

                        {/* 3. In-App Wallet */}
                        <div className="flex items-center justify-between p-4 transition-colors hover:bg-surface-muted/40">
                          <div className="flex flex-col gap-1 pr-4">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-slate-900">In-App Wallet</span>
                              <Badge tone={paymentController.settings.walletEnabled ? 'success' : 'neutral'}>
                                {paymentController.settings.walletEnabled ? 'Active' : 'Disabled'}
                              </Badge>
                            </div>
                            <span className="text-xs text-ink-muted">
                              Allows buyers to pay directly from their Krozenda account wallet balance.
                            </span>
                          </div>
                          <Switch
                            id="walletEnabled"
                            checked={paymentController.settings.walletEnabled}
                            onChange={(e) => paymentController.update('walletEnabled', e.target.checked)}
                          />
                        </div>
                      </div>

                      {paymentController.changed.length > 0 && (
                        <div className="flex items-center justify-between pt-2">
                          <span className="text-xs text-brand-700 font-semibold">
                            You have unsaved changes to payment methods.
                          </span>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="quiet"
                              size="control"
                              onClick={paymentController.discard}
                              disabled={paymentController.isSaving}
                            >
                              Discard
                            </Button>
                            <Button
                              type="button"
                              size="control"
                              onClick={() => paymentController.save()}
                              isLoading={paymentController.isSaving}
                            >
                              Save changes
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  ) : null}
                </div>
              </SectionCard>
            </div>
          )}
        </div>
      )}
    </SettingsShell>
  )
}
