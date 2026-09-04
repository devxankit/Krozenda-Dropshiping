import { useState, useEffect } from 'react'
import { Badge, Button, Input, Skeleton } from '../../../components/ui'
import { PageHeader } from '../../admin/components/shell/PageHeader'
import { PageBody } from '../../admin/components/shell/PageBody'
import { useVendorSettingsController } from '../controllers/useVendorController'
import { toast } from '../../admin/stores/toastStore'

export function SettingsPage() {
  const { data: settingsData, isLoading } = useVendorSettingsController()
  const [formData, setFormData] = useState(null)

  useEffect(() => {
    if (settingsData) {
      setFormData(settingsData)
    }
  }, [settingsData])

  const handleChange = (field, value) => {
    setFormData((prev) => (prev ? { ...prev, [field]: value } : prev))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    toast.success('Settings Saved', 'Vendor store details and warehouse pickup address updated successfully.')
  }

  if (isLoading || !formData) {
    return (
      <PageBody>
        <Skeleton className="h-96 w-full rounded-xl" />
      </PageBody>
    )
  }

  return (
    <PageBody>
      <PageHeader
        title="Vendor Store Settings"
        subtitle="Manage store identity, Shiprocket warehouse pickup location, and Razorpay Route payout info."
      />

      <form onSubmit={handleSubmit} className="flex flex-col gap-6 max-w-4xl">
        {/* Section 1: Business Profile */}
        <div className="rounded-xl border border-border bg-surface p-6 shadow-2xs">
          <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Business & Store Profile</h3>
              <p className="text-xs text-ink-subtle">General company details displayed on buyer invoices.</p>
            </div>
            <Badge tone="brand" size="sm">
              {formData.entityType}
            </Badge>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Store / Business Name"
              value={formData.storeName}
              onChange={(e) => handleChange('storeName', e.target.value)}
            />
            <Input
              label="Primary Contact Person"
              value={formData.contactPerson}
              onChange={(e) => handleChange('contactPerson', e.target.value)}
            />
            <Input
              label="Email Address"
              type="email"
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
            />
            <Input
              label="Phone Number"
              value={formData.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
            />
          </div>
        </div>

        {/* Section 2: Logistics & Warehouse Pickup */}
        <div className="rounded-xl border border-border bg-surface p-6 shadow-2xs">
          <div className="mb-4 border-b border-border pb-3">
            <h3 className="text-sm font-semibold text-slate-900">Logistics & Shiprocket Warehouse Location</h3>
            <p className="text-xs text-ink-subtle">
              Address where courier executives will arrive for package pickup.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="City"
              value={formData.city}
              onChange={(e) => handleChange('city', e.target.value)}
            />
            <Input
              label="Pickup Pincode"
              value={formData.pickupPincode}
              onChange={(e) => handleChange('pickupPincode', e.target.value)}
            />
            <div className="sm:col-span-2">
              <Input
                label="Full Pickup Address"
                value={formData.pickupAddress}
                onChange={(e) => handleChange('pickupAddress', e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Section 3: Razorpay Route Payout Account */}
        <div className="rounded-xl border border-border bg-surface p-6 shadow-2xs">
          <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Razorpay Route Linked Account</h3>
              <p className="text-xs text-ink-subtle">Direct bank payout account for order settlements.</p>
            </div>
            <Badge tone="success" size="sm">
              Account Linked ({formData.razorpayAccountId})
            </Badge>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input label="Bank Name" value={formData.bankName} disabled />
            <Input label="Account Number" value={formData.accountNumberMasked} disabled />
            <Input label="IFSC Code" value={formData.ifsc} disabled />
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="submit" variant="primary" size="md">
            Save Profile & Settings
          </Button>
        </div>
      </form>
    </PageBody>
  )
}
