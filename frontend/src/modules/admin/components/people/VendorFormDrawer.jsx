import { useEffect, useState } from 'react'
import { Badge, Button, Icon, Input, Select } from '../../../../components/ui'
import { FormDrawer } from '../forms/FormDrawer'
import { toast } from '../../stores/toastStore'

const MODEL_OPTIONS = [
  { value: 'marketplace', label: 'Marketplace Seller (Catalog Merchant)' },
  { value: 'dropshipping', label: 'Dropshipping Partner (Direct Supplier)' },
  { value: 'own_stock', label: 'Platform Owned Stock (Warehouse Inventory)' },
]

const ROLE_OPTIONS = [
  { value: 'Manufacturer', label: 'Manufacturer' },
  { value: 'Wholesaler', label: 'Wholesaler' },
  { value: 'Distributor', label: 'Distributor' },
  { value: 'Trader', label: 'Trader' },
  { value: 'Vendor / Seller', label: 'Vendor / Seller' },
  { value: 'Registered Company', label: 'Registered Company' },
]

const SYNC_OPTIONS = [
  { value: 'REST API Adapter', label: 'REST API Adapter (Automated Real-time Sync)' },
  { value: 'CSV / Excel Feed', label: 'CSV / Excel Scheduled Feed' },
  { value: 'Manual Web Portal', label: 'Manual Web Portal Access' },
  { value: 'Shopify / ERP Sync', label: 'Shopify / External ERP Connector' },
]

export function VendorFormDrawer({ isOpen, onClose, vendor = null, onSubmit }) {
  if (!isOpen) return null
  return <VendorFormDrawerBody onClose={onClose} vendor={vendor} onSubmit={onSubmit} />
}

function VendorFormDrawerBody({ onClose, vendor, onSubmit }) {
  const isEdit = Boolean(vendor)

  const [formData, setFormData] = useState({
    name: vendor?.name || '',
    model: vendor?.model || 'marketplace',
    role: vendor?.role || vendor?.supplierType || 'Manufacturer',
    city: vendor?.city || '',
    state: vendor?.state || '',
    gstin: vendor?.gstin || '',
    contactPerson: vendor?.contactPerson || '',
    phone: vendor?.phone || '',
    email: vendor?.email || '',
    integrationMode: vendor?.integrationMode || 'REST API Adapter',
    marginPct: vendor?.marginPct || vendor?.initialMarginPct || '15',
    routeLinked: vendor?.routeLinked ?? false,
    autoForward: vendor?.autoForward ?? true,
    status: vendor?.status || 'active',
  })

  const [activeTab, setActiveTab] = useState('basic') // 'basic' | 'contact' | 'compliance'

  function handleChange(field, value) {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  function handleSubmit(e) {
    e?.preventDefault?.()
    if (!formData.name.trim() || !formData.city.trim()) {
      toast.error('Missing Required Fields', 'Please enter company name and operating city.')
      return
    }

    const payload = {
      ...(vendor || {}),
      id: vendor?.id || `slr-${Math.floor(1000 + Math.random() * 9000)}`,
      name: formData.name.trim(),
      model: formData.model,
      role: formData.role,
      supplierType: formData.role,
      city: formData.city.trim(),
      state: formData.state.trim() || undefined,
      gstin: formData.gstin.trim() || '27AAFCN9612R1ZQ',
      contactPerson: formData.contactPerson.trim(),
      phone: formData.phone.trim(),
      email: formData.email.trim(),
      integrationMode: formData.integrationMode,
      marginPct: Number(formData.marginPct) || 15,
      routeLinked: formData.routeLinked,
      autoForward: formData.autoForward,
      status: formData.status,
      kycStatus: vendor?.kycStatus || 'submitted',
      products: vendor?.products ?? 0,
      orders: vendor?.orders ?? vendor?.ordersCount ?? 0,
      ordersCount: vendor?.ordersCount ?? vendor?.orders ?? 0,
      revenue: vendor?.revenue ?? 0,
      joinedAt: vendor?.joinedAt || 'Just now',
    }

    onSubmit?.(payload)
    toast.success(
      isEdit ? 'Vendor Profile Updated' : 'Vendor Onboarded Successfully',
      `${payload.name} has been saved to the seller directory.`,
    )
    onClose()
  }

  const initials = (formData.name || 'Vendor')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')

  return (
    <FormDrawer
      isOpen
      onClose={onClose}
      title={isEdit ? `Edit Vendor: ${vendor.name}` : 'Onboard New Seller / Partner'}
      description="Register and configure vendor credentials, business model, operating hubs, and payout routing."
      submitLabel={isEdit ? 'Save Changes' : 'Onboard Partner'}
      onSubmit={handleSubmit}
      width="lg"
      side="right"
    >
      <div className="flex flex-col gap-5">
        {/* Real-time Partner Preview Card */}
        <div className="group relative overflow-hidden rounded-2xl border border-slate-200/90 bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold uppercase tracking-wider text-slate-400">
              Live Directory Card
            </span>
            <div className="flex items-center gap-1.5">
              <Badge
                tone={formData.model === 'marketplace' ? 'brand' : formData.model === 'dropshipping' ? 'accent' : 'neutral'}
                size="sm"
              >
                {formData.model === 'marketplace' ? 'Marketplace' : formData.model === 'dropshipping' ? 'Dropshipping' : 'Platform Stock'}
              </Badge>
              <Badge tone={formData.routeLinked ? 'success' : 'warning'} dot size="sm">
                {formData.routeLinked ? 'Route Ready' : 'Pending Route'}
              </Badge>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-900 to-indigo-900 text-white font-black text-base shadow-sm ring-1 ring-slate-800/20">
              {initials || 'V'}
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="font-bold text-slate-900 text-sm truncate">
                {formData.name.trim() || 'Company / Brand Name'}
              </h4>
              <p className="text-xs text-slate-500 truncate">
                {formData.role} · {formData.city.trim() || 'City'}
                {formData.gstin ? ` · GST: ${formData.gstin.trim()}` : ''}
              </p>
            </div>
            <div className="hidden sm:flex flex-col items-end text-right">
              <span className="text-2xs font-semibold text-slate-400 uppercase">Margin Split</span>
              <span className="text-sm font-extrabold text-slate-900 tabular">{formData.marginPct}%</span>
            </div>
          </div>
        </div>

        {/* Section Tabs */}
        <div className="flex border-b border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('basic')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
              activeTab === 'basic'
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Icon name="sellers" className="h-3.5 w-3.5" />
            <span>Business Profile</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('contact')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
              activeTab === 'contact'
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Icon name="staff" className="h-3.5 w-3.5" />
            <span>Contact & Hub</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('compliance')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
              activeTab === 'compliance'
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Icon name="lock" className="h-3.5 w-3.5" />
            <span>Tax & Payouts</span>
          </button>
        </div>

        {/* Tab 1: Business Profile */}
        {activeTab === 'basic' && (
          <div className="flex flex-col gap-4">
            <Input
              label="Company / Legal Business Name"
              required
              placeholder="e.g. Nova Retail Pvt Ltd, Arya Manufacturing"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                label="Business Model"
                required
                value={formData.model}
                onChange={(e) => handleChange('model', e.target.value)}
                options={MODEL_OPTIONS}
              />
              <Select
                label="Entity Classification / Role"
                required
                value={formData.role}
                onChange={(e) => handleChange('role', e.target.value)}
                options={ROLE_OPTIONS}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                label="Catalog Sync & Integration"
                value={formData.integrationMode}
                onChange={(e) => handleChange('integrationMode', e.target.value)}
                options={SYNC_OPTIONS}
              />
              <Input
                label="Default Commission / Margin Rate (%)"
                type="number"
                placeholder="15"
                min="0"
                max="100"
                value={formData.marginPct}
                onChange={(e) => handleChange('marginPct', e.target.value)}
              />
            </div>

            {formData.model === 'dropshipping' && (
              <label className="flex items-start gap-3 rounded-xl border border-slate-200/90 bg-slate-50/60 p-3.5 cursor-pointer hover:bg-slate-50 transition-colors">
                <input
                  type="checkbox"
                  checked={formData.autoForward}
                  onChange={(e) => handleChange('autoForward', e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                <div>
                  <p className="text-xs font-semibold text-slate-900">Automated Dropship Order Forwarding</p>
                  <p className="text-2xs text-slate-500">
                    Automatically route line items from paid buyer orders directly to this partner's sync adapter.
                  </p>
                </div>
              </label>
            )}
          </div>
        )}

        {/* Tab 2: Contact & Location */}
        {activeTab === 'contact' && (
          <div className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Operating City / Hub"
                required
                placeholder="e.g. Mumbai, Surat, Delhi"
                value={formData.city}
                onChange={(e) => handleChange('city', e.target.value)}
              />
              <Input
                label="State / Region"
                placeholder="e.g. Maharashtra, Gujarat"
                value={formData.state}
                onChange={(e) => handleChange('state', e.target.value)}
              />
            </div>

            <Input
              label="Primary Contact Person"
              placeholder="e.g. Rohan Mehta (Director)"
              value={formData.contactPerson}
              onChange={(e) => handleChange('contactPerson', e.target.value)}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Official Email Address"
                type="email"
                placeholder="vendor@company.com"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
              />
              <Input
                label="Contact Phone Number"
                type="tel"
                placeholder="+91 98204 00000"
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Tab 3: Tax & Payouts */}
        {activeTab === 'compliance' && (
          <div className="flex flex-col gap-4">
            <Input
              label="GSTIN Identification Number"
              placeholder="e.g. 27AAFCN9612R1ZQ"
              value={formData.gstin}
              onChange={(e) => handleChange('gstin', e.target.value.toUpperCase())}
            />

            <div className="rounded-2xl border border-slate-200/90 bg-slate-50/70 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    Razorpay Route Split Settlement
                  </h4>
                  <p className="mt-0.5 text-2xs text-slate-500">
                    Enable direct platform-to-vendor split payouts for automated escrow settlements.
                  </p>
                </div>
                <Badge tone={formData.routeLinked ? 'success' : 'neutral'} size="sm">
                  {formData.routeLinked ? 'Linked' : 'Not Linked'}
                </Badge>
              </div>

              <div className="mt-3.5 flex items-center gap-2">
                <Button
                  type="button"
                  size="xs"
                  variant={formData.routeLinked ? 'secondary' : 'primary'}
                  onClick={() => handleChange('routeLinked', !formData.routeLinked)}
                >
                  {formData.routeLinked ? 'Mark as Unlinked' : 'Link Razorpay Route Now'}
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-700">Account Status</label>
              <div className="flex items-center gap-2">
                {['active', 'pending', 'suspended'].map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => handleChange('status', st)}
                    className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold capitalize transition-all ${
                      formData.status === st
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </FormDrawer>
  )
}
