import { useRef, useState } from 'react'
import { PageShell } from '../../../components/layout'
import { Skeleton, Badge, Button, Input, Select, Toast } from '../../../components/ui'
import { useKycController } from '../controllers/useKycController'
import { VENDOR_STATUS_LABELS } from '../constants'
import { BUSINESS_MODEL, BUSINESS_MODEL_LABELS } from '../../../config/constants'

const BUSINESS_MODEL_OPTIONS = [BUSINESS_MODEL.MARKETPLACE, BUSINESS_MODEL.DROPSHIPPING].map((value) => ({
  value,
  label: BUSINESS_MODEL_LABELS[value],
}))

function RegistrationForm({ onRegister, isRegistering, registerError }) {
  const [storeName, setStoreName] = useState('')
  const [businessModel, setBusinessModel] = useState(BUSINESS_MODEL.MARKETPLACE)

  const handleSubmit = (event) => {
    event.preventDefault()
    onRegister({ storeName, businessModel })
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-4 rounded-lg border border-border bg-surface p-6">
      <p className="text-sm text-slate-600">
        Create your seller profile before uploading KYC documents.
      </p>
      <Input
        id="storeName"
        label="Store name"
        value={storeName}
        onChange={(e) => setStoreName(e.target.value)}
        placeholder="e.g. Acme Traders"
        required
      />
      <Select
        id="businessModel"
        label="Business model"
        options={BUSINESS_MODEL_OPTIONS}
        value={businessModel}
        onChange={(e) => setBusinessModel(e.target.value)}
      />
      {registerError && <Toast tone="danger" message={registerError.message} />}
      <Button type="submit" disabled={isRegistering || !storeName.trim()}>
        {isRegistering ? 'Creating...' : 'Create seller profile'}
      </Button>
    </form>
  )
}

function DocumentUploadForm({ onUpload, isUploading, uploadError }) {
  const [documentType, setDocumentType] = useState('')
  const [files, setFiles] = useState([])
  const fileInputRef = useRef(null)

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (files.length === 0) return
    await onUpload({ documentType: documentType || 'other', files })
    setDocumentType('')
    setFiles([])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-4 rounded-lg border border-border bg-surface p-6">
      <Input
        id="documentType"
        label="Document type"
        value={documentType}
        onChange={(e) => setDocumentType(e.target.value)}
        placeholder="e.g. PAN Card, GST Certificate"
      />
      <div className="flex flex-col gap-1">
        <label htmlFor="documents" className="text-sm font-medium text-slate-700">
          Files
        </label>
        <input
          ref={fileInputRef}
          id="documents"
          type="file"
          accept="image/*,application/pdf"
          multiple
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          className="text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-700"
        />
      </div>
      {uploadError && <Toast tone="danger" message={uploadError.message} />}
      <Button type="submit" disabled={isUploading || files.length === 0}>
        {isUploading ? 'Uploading...' : 'Upload documents'}
      </Button>
    </form>
  )
}

function DocumentList({ documents }) {
  if (documents.length === 0) {
    return <p className="text-sm text-slate-500">No documents uploaded yet.</p>
  }

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {documents.map((doc) => (
        <li key={doc.url} className="overflow-hidden rounded-lg border border-border bg-surface">
          <a href={doc.url} target="_blank" rel="noreferrer" className="block">
            {doc.url.match(/\.(png|jpe?g|webp|gif)$/i) ? (
              <img src={doc.url} alt={doc.documentType} className="h-24 w-full object-cover" />
            ) : (
              <div className="flex h-24 w-full items-center justify-center bg-surface-muted text-xs text-slate-500">
                PDF document
              </div>
            )}
          </a>
          <div className="px-2 py-1.5 text-xs text-slate-600 truncate">{doc.documentType}</div>
        </li>
      ))}
    </ul>
  )
}

// Wires up KYC document upload for the seller/dropshipping-partner surface
// (see project-phase notes on Seller.js and modules/seller/routes.js).
// Any signed-in seller can immediately see the documents they've uploaded
// here — the same "upload goes to shared server disk, comes back as a
// public URL" pattern as RateReviewScreen's review photos.
export function KycDocumentsPage() {
  const {
    profile,
    isLoading,
    isNotRegistered,
    loadError,
    register,
    isRegistering,
    registerError,
    uploadDocuments,
    isUploading,
    uploadError,
  } = useKycController()

  if (isLoading) {
    return (
      <PageShell title="KYC Documents">
        <Skeleton className="h-40 w-full" />
      </PageShell>
    )
  }

  if (loadError) {
    return (
      <PageShell title="KYC Documents">
        <p className="text-sm text-danger-700">{loadError.message}</p>
      </PageShell>
    )
  }

  return (
    <PageShell
      title="KYC Documents"
      actions={profile && <Badge tone="brand">{VENDOR_STATUS_LABELS[profile.status] ?? profile.status}</Badge>}
    >
      {isNotRegistered || !profile ? (
        <RegistrationForm onRegister={register} isRegistering={isRegistering} registerError={registerError} />
      ) : (
        <div className="flex flex-col gap-6">
          <DocumentUploadForm onUpload={uploadDocuments} isUploading={isUploading} uploadError={uploadError} />
          <div>
            <h2 className="mb-2 text-sm font-semibold text-slate-900">Uploaded documents</h2>
            <DocumentList documents={profile.kycDocuments} />
          </div>
        </div>
      )}
    </PageShell>
  )
}
