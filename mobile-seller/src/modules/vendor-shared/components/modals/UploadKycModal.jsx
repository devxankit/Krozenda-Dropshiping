import { useState } from 'react'
import { View } from 'react-native'
import { Button, Modal, Select } from '../../../../components/ui'
import { toast } from '../../../../lib/toast'
import { useVendorUploadKycController } from '../../controllers/useVendorController'
import { appendFile } from '../../lib/filePicker'
import { FilePickerField } from './FilePickerField'

const DOCUMENT_TYPES = [
  { value: 'GST_CERTIFICATE', label: 'GST Registration Certificate' },
  { value: 'PAN_CARD', label: 'Company / Proprietor PAN Card' },
  { value: 'CANCELLED_CHEQUE', label: 'Cancelled Cheque / Bank Proof' },
  { value: 'FSSAI_LICENSE', label: 'FSSAI Food Safety License' },
  { value: 'FOOD_TEST_CERTIFICATE', label: 'Food Test Certificate (Lab Report)' },
  { value: 'ADDRESS_PROOF', label: 'Aadhaar / Passport / Electricity Bill' },
]

// The web accepts .pdf, .jpg, .jpeg, .png here.
const KYC_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png']

export function UploadKycModal({ isOpen, onClose }) {
  const [docType, setDocType] = useState(DOCUMENT_TYPES[0].value)
  const [file, setFile] = useState(null)
  const { upload, isSubmitting } = useVendorUploadKycController()

  async function handleSubmit() {
    if (isSubmitting) return
    if (!file) {
      toast.error('File Required', 'Please choose a document file to upload.')
      return
    }

    const formData = new FormData()
    formData.append('documentType', docType)
    formData.append('documentLabel', DOCUMENT_TYPES.find((d) => d.value === docType)?.label || docType)
    appendFile(formData, 'file', file)

    try {
      await upload(formData)
      toast.success('Document Uploaded', 'Your document was submitted for admin review.')
      onClose()
      setFile(null)
    } catch (err) {
      toast.error('Upload failed', err?.response?.data?.message || 'Could not upload document')
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Upload Business KYC Document"
      description="Upload government registration certificate or identity document for Admin verification."
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} icon="upload" disabled={isSubmitting}>
            {isSubmitting ? 'Uploading…' : 'Upload document'}
          </Button>
        </>
      }
    >
      <View style={{ gap: 16 }}>
        <Select label="Document Type" value={docType} onChange={(e) => setDocType(e.target.value)} options={DOCUMENT_TYPES} />
        <FilePickerField label="Select File" file={file} onChange={setFile} types={KYC_FILE_TYPES} />
      </View>
    </Modal>
  )
}
