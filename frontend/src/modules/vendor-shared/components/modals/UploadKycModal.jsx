import { useState } from 'react'
import { Button, Input, Modal, Select } from '../../../../components/ui'
import { toast } from '../../../admin/stores/toastStore'

export function UploadKycModal({ isOpen, onClose }) {
  const [docType, setDocType] = useState('GST Certificate')
  const [fileName, setFileName] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    if (!fileName) {
      toast.error('File Required', 'Please choose a document file to upload.')
      return
    }

    toast.success(
      'Document Uploaded for Review',
      `${docType} (${fileName}) uploaded successfully. Admin review queued.`,
    )
    onClose()
    setFileName('')
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
          <Button onClick={handleSubmit} icon="upload">
            Upload document
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Select
          label="Document Type"
          value={docType}
          onChange={(e) => setDocType(e.target.value)}
          options={[
            { value: 'GST Certificate', label: 'GST Registration Certificate' },
            { value: 'PAN Card', label: 'Company / Proprietor PAN Card' },
            { value: 'Cancelled Cheque', label: 'Cancelled Cheque / Bank Proof' },
            { value: 'FSSAI License', label: 'FSSAI Food Safety License' },
            { value: 'Address Proof', label: 'Aadhaar / Passport / Electricity Bill' },
          ]}
        />

        <Input
          label="Select File"
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={(e) => setFileName(e.target.files[0]?.name || '')}
        />
      </form>
    </Modal>
  )
}
