import { useState } from 'react'
import { Button, Input } from '../../../components/ui'
import { PageBody, PageHeader } from '../../admin/components/shell'
import { SectionCard } from '../../admin/components/display'
import { toast } from '../../admin/stores/toastStore'
import { useVendorProfileController } from '../controllers/useVendorController'

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
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          <Input label="Contact Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="Mobile Number" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
          <Input label="Store / Business Name" value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} className="sm:col-span-2" />
        </div>
      </SectionCard>

      <SectionCard title="Pickup Address">
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          <Input label="Address Line" value={form.addressLine} onChange={(e) => setForm({ ...form, addressLine: e.target.value })} className="sm:col-span-2" />
          <Input label="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          <Input label="State" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
          <Input label="Pincode" value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} />
        </div>
      </SectionCard>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSubmitting} icon="save">
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
        <StoreProfileForm vendor={vendor} updateProfile={updateProfile} isSubmitting={isSubmitting} />
      )}
    </PageBody>
  )
}
