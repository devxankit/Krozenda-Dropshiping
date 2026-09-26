import { useState } from 'react'
import { Badge, Button, Checkbox, Input, Skeleton } from '../../../components/ui'
import { PageHeader } from '../../admin/components/shell/PageHeader'
import { PageBody } from '../../admin/components/shell/PageBody'
import { useVendorSettingsController } from '../controllers/useVendorController'
import { toast } from '../../admin/stores/toastStore'

function SettingsForm({ settingsData, updateSettings, isSubmitting }) {
  const [formData, setFormData] = useState({
    accountHolderName: settingsData.bank?.accountHolderName || '',
    bankName: settingsData.bank?.bankName || '',
    accountNumber: settingsData.bank?.accountNumber || '',
    ifsc: settingsData.bank?.ifsc || '',
    orderUpdates: settingsData.notificationPrefs?.orderUpdates ?? true,
    promotions: settingsData.notificationPrefs?.promotions ?? true,
  })

  const handleChange = (field, value) => setFormData((prev) => ({ ...prev, [field]: value }))

  async function handleSubmit(e) {
    e.preventDefault()
    try {
      await updateSettings({
        bank: {
          accountHolderName: formData.accountHolderName,
          bankName: formData.bankName,
          accountNumber: formData.accountNumber,
          ifsc: formData.ifsc,
        },
        notificationPrefs: { orderUpdates: formData.orderUpdates, promotions: formData.promotions },
      })
      toast.success('Settings Saved', 'Your payout details and preferences were updated.')
    } catch (err) {
      toast.error('Could not save settings', err?.response?.data?.message || 'Something went wrong')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 sm:gap-6 max-w-4xl">
      <div className="rounded-xl border border-slate-200/80 bg-surface p-3.5 sm:p-6 shadow-2xs">
        <div className="mb-3 sm:mb-4 flex items-center justify-between border-b border-border pb-2.5 sm:pb-3">
          <div>
            <h3 className="text-xs sm:text-sm font-semibold text-slate-900">Payout Bank Account</h3>
            <p className="text-[11px] sm:text-xs text-ink-subtle">Used for settlement payouts once your account is approved.</p>
          </div>
          <Badge tone="brand" size="sm">
            Commission{' '}
            {settingsData.commissionRateType === 'FIXED'
              ? `₹${settingsData.commissionRateValue}/unit`
              : `${settingsData.commissionRatePercent}%`}
          </Badge>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:gap-4 sm:grid-cols-2">
          <Input label="Account Holder Name" value={formData.accountHolderName} onChange={(e) => handleChange('accountHolderName', e.target.value)} />
          <Input label="Bank Name" value={formData.bankName} onChange={(e) => handleChange('bankName', e.target.value)} />
          <Input label="Account Number" value={formData.accountNumber} onChange={(e) => handleChange('accountNumber', e.target.value)} />
          <Input label="IFSC Code" value={formData.ifsc} onChange={(e) => handleChange('ifsc', e.target.value)} />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200/80 bg-surface p-3.5 sm:p-6 shadow-2xs">
        <div className="mb-3 sm:mb-4 border-b border-border pb-2.5 sm:pb-3">
          <h3 className="text-xs sm:text-sm font-semibold text-slate-900">Notification Preferences</h3>
        </div>
        <div className="flex flex-col gap-2.5 sm:gap-3">
          <label className="flex items-center gap-2 text-xs">
            <Checkbox checked={formData.orderUpdates} onChange={(e) => handleChange('orderUpdates', e.target.checked)} />
            Order updates (new orders, status changes, returns)
          </label>
          <label className="flex items-center gap-2 text-xs">
            <Checkbox checked={formData.promotions} onChange={(e) => handleChange('promotions', e.target.checked)} />
            Promotions and platform announcements
          </label>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-1 sm:pt-2">
        <Button type="submit" variant="primary" size="md" disabled={isSubmitting} className="w-full sm:w-auto">
          {isSubmitting ? 'Saving…' : 'Save Settings'}
        </Button>
      </div>
    </form>
  )
}

export function SettingsPage() {
  const { data: settingsData, isLoading, updateSettings, isSubmitting } = useVendorSettingsController()

  if (isLoading || !settingsData) {
    return (
      <PageBody>
        <Skeleton className="h-96 w-full rounded-xl" />
      </PageBody>
    )
  }

  return (
    <PageBody>
      <PageHeader title="Settings" subtitle="Payout bank details and notification preferences." />
      <SettingsForm settingsData={settingsData} updateSettings={updateSettings} isSubmitting={isSubmitting} />
    </PageBody>
  )
}
