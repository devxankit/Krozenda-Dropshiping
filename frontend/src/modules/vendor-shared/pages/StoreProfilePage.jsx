import { useState } from 'react'
import { Badge, Button, Input } from '../../../components/ui'
import { PageBody, PageHeader } from '../../admin/components/shell'
import { SectionCard } from '../../admin/components/display'
import { toast } from '../../admin/stores/toastStore'
import {
  useVendorFssaiController,
  useVendorProfileController,
  useVendorUploadKycController,
} from '../controllers/useVendorController'

const FSSAI_STATUS = {
  MISSING: { tone: 'neutral', label: 'Not uploaded' },
  PENDING: { tone: 'warning', label: 'Under review' },
  APPROVED: { tone: 'success', label: 'Approved' },
  REJECTED: { tone: 'danger', label: 'Rejected' },
}

// Needed before admin will approve any food category this seller proposes
// (backend utils/fssai.js). Upload goes through the ordinary KYC document
// endpoint as an FSSAI_LICENSE and waits for admin review like any other.
function FssaiLicenceCard() {
  const { data, isLoading } = useVendorFssaiController()
  const { upload, isSubmitting } = useVendorUploadKycController()
  const [number, setNumber] = useState('')
  const [file, setFile] = useState(null)
  const [fileKey, setFileKey] = useState(0)

  const status = data?.status || 'MISSING'
  const doc = data?.document
  const canUpload = status === 'MISSING' || status === 'REJECTED'

  async function handleUpload() {
    if (!/^\d{14}$/.test(number.trim())) {
      toast.error('Invalid licence number', 'Enter your 14-digit FSSAI licence number.')
      return
    }
    if (!file) {
      toast.error('File required', 'Choose your FSSAI licence (PDF or image).')
      return
    }
    const formData = new FormData()
    formData.append('documentType', 'FSSAI_LICENSE')
    formData.append('documentLabel', 'FSSAI Food Safety Licence')
    formData.append('documentNumber', number.trim())
    formData.append('file', file)
    try {
      await upload(formData)
      toast.success('Licence submitted', 'Admin will review your FSSAI licence.')
      setNumber('')
      setFile(null)
      setFileKey((k) => k + 1)
    } catch (err) {
      toast.error('Upload failed', err?.response?.data?.message || 'Could not upload licence')
    }
  }

  return (
    <SectionCard
      title="FSSAI Food Licence"
      actions={!isLoading && <Badge tone={FSSAI_STATUS[status].tone} dot size="sm">{FSSAI_STATUS[status].label}</Badge>}
    >
      <div className="flex flex-col gap-3 p-4">
        <p className="text-xs text-slate-500">
          Required to sell food, grocery or beverages. Any food category you add is approved only after admin approves this licence.
        </p>

        {doc && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>
                Licence no. <span className="font-mono font-semibold text-slate-900">{doc.documentNumber || '—'}</span>
              </span>
              {doc.documentUrl && (
                <a href={doc.documentUrl} target="_blank" rel="noreferrer" className="font-semibold text-brand-600 hover:underline">
                  View file
                </a>
              )}
            </div>
            {status === 'REJECTED' && doc.rejectionReason && (
              <p className="mt-1.5 text-danger-600">Rejected: {doc.rejectionReason}</p>
            )}
          </div>
        )}

        {canUpload && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="FSSAI Licence Number"
              inputMode="numeric"
              maxLength={14}
              placeholder="14-digit licence number"
              value={number}
              onChange={(e) => setNumber(e.target.value.replace(/\D/g, ''))}
            />
            <Input
              key={fileKey}
              label="Licence File"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <div className="flex justify-end sm:col-span-2">
              <Button onClick={handleUpload} disabled={isSubmitting} icon="upload">
                {isSubmitting ? 'Uploading…' : status === 'REJECTED' ? 'Re-upload licence' : 'Upload licence'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  )
}

function StoreProfileForm({ vendor, updateProfile, isSubmitting }) {
  const [form, setForm] = useState({
    name: vendor.name || '',
    mobile: vendor.mobile || '',
    businessName: vendor.business?.businessName || '',
    addressLine: vendor.address?.addressLine || '',
    city: vendor.address?.city || '',
    state: vendor.address?.state || '',
    pincode: vendor.address?.pincode || '',
  })

  async function handleSave() {
    try {
      await updateProfile({
        name: form.name,
        mobile: form.mobile,
        business: { businessName: form.businessName },
        address: { addressLine: form.addressLine, city: form.city, state: form.state, pincode: form.pincode },
      })
      toast.success('Profile updated', 'Your store profile was saved.')
    } catch (err) {
      toast.error('Could not save profile', err?.response?.data?.message || 'Something went wrong')
    }
  }

  return (
    <>
      <SectionCard title="Business Details">
        <div className="grid gap-2.5 p-3.5 sm:gap-3 sm:p-4 sm:grid-cols-2">
          <Input label="Contact Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="Mobile Number" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
          <Input label="Store / Business Name" value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} className="sm:col-span-2" />
        </div>
      </SectionCard>

      <SectionCard title="Pickup Address">
        <div className="grid gap-2.5 p-3.5 sm:gap-3 sm:p-4 sm:grid-cols-2">
          <Input label="Address Line" value={form.addressLine} onChange={(e) => setForm({ ...form, addressLine: e.target.value })} className="sm:col-span-2" />
          <Input label="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          <Input label="State" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
          <Input label="Pincode" value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} />
        </div>
      </SectionCard>

      <div className="flex justify-end pt-1">
        <Button onClick={handleSave} disabled={isSubmitting} icon="save" className="w-full sm:w-auto">
          {isSubmitting ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </>
  )
}

export function StoreProfilePage() {
  const { data: vendor, isLoading, updateProfile, isSubmitting } = useVendorProfileController()

  return (
    <PageBody>
      <PageHeader title="Store Profile" description="Your store's public identity and business details." />

      {isLoading || !vendor ? (
        <p className="text-xs text-ink-subtle">Loading profile…</p>
      ) : (
        <>
          <StoreProfileForm vendor={vendor} updateProfile={updateProfile} isSubmitting={isSubmitting} />
          <FssaiLicenceCard />
        </>
      )}
    </PageBody>
  )
}
