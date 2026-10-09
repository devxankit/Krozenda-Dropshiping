import { useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { Badge, Button, Checkbox, Input, Skeleton, Text } from '../../../components/ui'
import { PageHeader } from '../../../components/admin/shell/PageHeader'
import { PageBody } from '../../../components/admin/shell/PageBody'
import { useVendorSettingsController } from '../controllers/useVendorController'
import { toast } from '../../../lib/toast'
import { colors, shadows } from '../../../theme'

function CheckRow({ checked, onChange, children }) {
  return (
    <Pressable onPress={() => onChange(!checked)} accessibilityRole="checkbox" accessibilityState={{ checked }} style={styles.checkRow}>
      <View pointerEvents="none">
        <Checkbox checked={checked} />
      </View>
      <Text style={styles.checkText}>{children}</Text>
    </Pressable>
  )
}

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

  async function handleSubmit() {
    if (isSubmitting) return
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
    <View style={{ gap: 14 }}>
      <View style={[styles.card, shadows['2xs']]}>
        <View style={[styles.cardHead, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }]}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.cardTitle}>Payout Bank Account</Text>
            <Text style={styles.cardSub}>Used for settlement payouts once your account is approved.</Text>
          </View>
          <Badge tone="brand" size="sm">
            {`Commission ${
              settingsData.commissionRateType === 'FIXED' ? `₹${settingsData.commissionRateValue}/unit` : `${settingsData.commissionRatePercent}%`
            }`}
          </Badge>
        </View>

        <View style={{ gap: 10 }}>
          <Input label="Account Holder Name" value={formData.accountHolderName} onChange={(e) => handleChange('accountHolderName', e.target.value)} />
          <Input label="Bank Name" value={formData.bankName} onChange={(e) => handleChange('bankName', e.target.value)} />
          <Input label="Account Number" keyboardType="number-pad" value={formData.accountNumber} onChange={(e) => handleChange('accountNumber', e.target.value)} />
          <Input label="IFSC Code" autoCapitalize="characters" autoCorrect={false} value={formData.ifsc} onChange={(e) => handleChange('ifsc', e.target.value)} />
        </View>
      </View>

      <View style={[styles.card, shadows['2xs']]}>
        <View style={styles.cardHead}>
          <Text style={styles.cardTitle}>Notification Preferences</Text>
        </View>
        <View style={{ gap: 10 }}>
          <CheckRow checked={formData.orderUpdates} onChange={(v) => handleChange('orderUpdates', v)}>
            Order updates (new orders, status changes, returns)
          </CheckRow>
          <CheckRow checked={formData.promotions} onChange={(v) => handleChange('promotions', v)}>
            Promotions and platform announcements
          </CheckRow>
        </View>
      </View>

      <View style={{ paddingTop: 4 }}>
        <Button variant="primary" size="md" onClick={handleSubmit} disabled={isSubmitting} style={{ width: '100%' }}>
          {isSubmitting ? 'Saving…' : 'Save Settings'}
        </Button>
      </View>
    </View>
  )
}

export function SettingsPage() {
  const { data: settingsData, isLoading, updateSettings, isSubmitting } = useVendorSettingsController()

  if (isLoading || !settingsData) {
    return (
      <PageBody>
        <Skeleton style={{ height: 384, width: '100%', borderRadius: 12 }} />
      </PageBody>
    )
  }

  return (
    <PageBody>
      <PageHeader title="Settings" />
      <SettingsForm settingsData={settingsData} updateSettings={updateSettings} isSubmitting={isSubmitting} />
    </PageBody>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.8)',
    backgroundColor: colors.surface.DEFAULT,
    padding: 14,
  },
  cardHead: { marginBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border.DEFAULT, paddingBottom: 10 },
  cardTitle: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.slate[900] },
  cardSub: { fontSize: 11, lineHeight: 16, color: colors.ink.subtle },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkText: { flex: 1, fontSize: 12, lineHeight: 16, color: colors.slate[900] },
})
