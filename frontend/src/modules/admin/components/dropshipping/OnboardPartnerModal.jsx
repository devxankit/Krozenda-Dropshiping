import { useState } from 'react'
import { Button, Input, Modal, Select } from '../../../../components/ui'
import { toast } from '../../stores/toastStore'

export function OnboardPartnerModal({ isOpen, onClose, onAddPartner }) {
  const [formData, setFormData] = useState({
    name: '',
    supplierType: 'Manufacturer',
    city: '',
    gstin: '',
    contactPerson: '',
    phone: '',
    email: '',
    integrationMode: 'REST API Adapter',
    initialMarginPct: '15',
  })

  function handleSubmit(e) {
    e.preventDefault()
    if (!formData.name || !formData.city) {
      toast.error('Missing Required Fields', 'Please fill in partner name and city.')
      return
    }

    const newPartner = {
      id: `prt-${Math.floor(1000 + Math.random() * 9000)}`,
      name: formData.name,
      supplierType: formData.supplierType,
      city: formData.city,
      gstin: formData.gstin || '07AAAAA0000A1Z5',
      integrationMode: formData.integrationMode,
      products: 0,
      ordersCount: 0,
      revenue: 0,
      kycStatus: 'submitted',
      routeLinked: false,
      autoForward: true,
      joinedAt: 'Just now',
      status: 'active',
    }

    onAddPartner?.(newPartner)
    toast.success(
      'Partner Onboarded',
      `${formData.name} was successfully onboarded. KYC application queued for review.`,
    )
    onClose()
    setFormData({
      name: '',
      supplierType: 'Manufacturer',
      city: '',
      gstin: '',
      contactPerson: '',
      phone: '',
      email: '',
      integrationMode: 'REST API Adapter',
      initialMarginPct: '15',
    })
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Onboard Dropshipping Partner"
      description="Register a new external manufacturer, wholesaler or distributor for Model A Direct Dropshipping."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} icon="add">
            Onboard partner
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Company / Business Name"
            placeholder="e.g. Acme Manufacturing Pvt Ltd"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <Select
            label="Supplier Entity Type"
            value={formData.supplierType}
            onChange={(e) => setFormData({ ...formData, supplierType: e.target.value })}
            options={[
              { value: 'Manufacturer', label: 'Manufacturer' },
              { value: 'Wholesaler', label: 'Wholesaler' },
              { value: 'Distributor', label: 'Distributor' },
              { value: 'Trader', label: 'Trader' },
              { value: 'Company', label: 'Registered Company' },
            ]}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Operating City / Location"
            placeholder="e.g. Bengaluru"
            value={formData.city}
            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            required
          />
          <Input
            label="GSTIN Identification"
            placeholder="e.g. 29AAFCN9612R1ZQ"
            value={formData.gstin}
            onChange={(e) => setFormData({ ...formData, gstin: e.target.value })}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Input
            label="Contact Person"
            placeholder="Name"
            value={formData.contactPerson}
            onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
          />
          <Input
            label="Phone Number"
            placeholder="+91 98000 00000"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          />
          <Input
            label="Email Address"
            placeholder="supplier@example.com"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            label="Stock & Order Sync Mode"
            value={formData.integrationMode}
            onChange={(e) => setFormData({ ...formData, integrationMode: e.target.value })}
            options={[
              { value: 'REST API Adapter', label: 'REST API Adapter (Automated)' },
              { value: 'CSV / Excel Feed', label: 'CSV / Excel Feed Adapter' },
              { value: 'Manual Portal', label: 'Manual Web Portal' },
            ]}
          />
          <Input
            label="Default Commission Rate (%)"
            type="number"
            placeholder="15"
            value={formData.initialMarginPct}
            onChange={(e) => setFormData({ ...formData, initialMarginPct: e.target.value })}
          />
        </div>
      </form>
    </Modal>
  )
}
