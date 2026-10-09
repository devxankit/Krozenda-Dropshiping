import { useState } from 'react'
import { Linking, StyleSheet, View } from 'react-native'
import { Badge, Button, Input, Text } from '../../../components/ui'
import { PageBody, PageHeader } from '../../../components/admin/shell'
import { SectionCard } from '../../../components/admin/display'
import { toast } from '../../../lib/toast'
import {
  useVendorFssaiController,
  useVendorProfileController,
  useVendorUploadKycController,
} from '../controllers/useVendorController'
import { FilePickerField } from '../components/modals/FilePickerField'
import { appendFile } from '../lib/filePicker'
import { colors } from '../../../theme'

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

  const status = data?.status || 'MISSING'
  const doc = data?.document
  const canUpload = status === 'MISSING' || status === 'REJECTED'

  async function handleUpload() {
    if (isSubmitting) return
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
    appendFile(formData, 'file', file)
    try {
      await upload(formData)
      toast.success('Licence submitted', 'Admin will review your FSSAI licence.')
      setNumber('')
      setFile(null)
    } catch (err) {
      toast.error('Upload failed', err?.response?.data?.message || 'Could not upload licence')
    }
  }

  return (
    <SectionCard
      title="FSSAI Food Licence"
      actions={
        !isLoading ? (
          <Badge tone={FSSAI_STATUS[status].tone} dot size="sm">
            {FSSAI_STATUS[status].label}
          </Badge>
        ) : null
      }
    >
      <View style={{ gap: 12, padding: 16 }}>
        <Text style={styles.help}>
          Required to sell food, grocery or beverages. Any food category you add is approved only after admin approves this licence.
        </Text>

        {doc ? (
          <View style={styles.docBox}>
            <View style={styles.docRow}>
              <Text style={styles.docText}>
                Licence no.{' '}
                <Text noTranslate style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: '600', color: colors.slate[900] }}>
                  {doc.documentNumber || '—'}
                </Text>
              </Text>
              {doc.documentUrl ? (
                <Text onPress={() => Linking.openURL(doc.documentUrl).catch(() => {})} style={styles.docLink}>
                  View file
                </Text>
              ) : null}
            </View>
            {status === 'REJECTED' && doc.rejectionReason ? <Text style={styles.docRejected}>{`Rejected: ${doc.rejectionReason}`}</Text> : null}
          </View>
        ) : null}

        {canUpload ? (
          <View style={{ gap: 12 }}>
            <Input
              label="FSSAI Licence Number"
              keyboardType="number-pad"
              maxLength={14}
              placeholder="14-digit licence number"
              value={number}
              onChange={(e) => setNumber(e.target.value.replace(/\D/g, ''))}
            />
            <FilePickerField label="Licence File" file={file} onChange={setFile} />
            <View style={{ alignItems: 'flex-end' }}>
              <Button onClick={handleUpload} disabled={isSubmitting} icon="upload">
                {isSubmitting ? 'Uploading…' : status === 'REJECTED' ? 'Re-upload licence' : 'Upload licence'}
              </Button>
            </View>
          </View>
        ) : null}
      </View>
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
    if (isSubmitting) return
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
        <View style={styles.fields}>
          <Input label="Contact Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="Mobile Number" type="tel" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
          <Input label="Store / Business Name" value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} />
        </View>
      </SectionCard>

      <SectionCard title="Pickup Address">
        <View style={styles.fields}>
          <Input label="Address Line" value={form.addressLine} onChange={(e) => setForm({ ...form, addressLine: e.target.value })} />
          <Input label="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          <Input label="State" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
          <Input label="Pincode" keyboardType="number-pad" value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} />
        </View>
      </SectionCard>

      <View style={{ paddingTop: 4 }}>
        <Button onClick={handleSave} disabled={isSubmitting} icon="save" style={{ width: '100%' }}>
          {isSubmitting ? 'Saving…' : 'Save changes'}
        </Button>
      </View>
    </>
  )
}

export function StoreProfilePage() {
  const { data: vendor, isLoading, updateProfile, isSubmitting } = useVendorProfileController()

  return (
    <PageBody>
      <PageHeader title="Store Profile" description="Your store's public identity and business details." />

      {isLoading || !vendor ? (
        <Text style={styles.loading}>Loading profile…</Text>
      ) : (
        <>
          <StoreProfileForm vendor={vendor} updateProfile={updateProfile} isSubmitting={isSubmitting} />
          <FssaiLicenceCard />
        </>
      )}
    </PageBody>
  )
}

const styles = StyleSheet.create({
  loading: { fontSize: 12, lineHeight: 16, color: colors.ink.subtle },
  fields: { gap: 10, padding: 14 },
  help: { fontSize: 12, lineHeight: 16, color: colors.slate[500] },
  docBox: { borderRadius: 12, borderWidth: 1, borderColor: colors.slate[200], backgroundColor: colors.slate[50], padding: 12 },
  docRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  docText: { fontSize: 12, lineHeight: 16, color: colors.slate[600] },
  docLink: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.brand[600] },
  docRejected: { marginTop: 6, fontSize: 12, lineHeight: 16, color: colors.danger[600] },
})
