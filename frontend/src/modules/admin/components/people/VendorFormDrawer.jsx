import { useForm } from 'react-hook-form'
import { Icon, Input, Select } from '../../../../components/ui'
import { FormDrawer } from '../forms/FormDrawer'

// Seller type on this marketplace, matching Vendor.vendorType. It decides
// which half of the form is required: a B2B partner trades as a registered
// business with an authorised signatory, a B2C partner sells as themselves.
const PARTNER_TYPES = [
  {
    value: 'B2C',
    icon: 'customers',
    title: 'B2C partner',
    blurb: 'Individual or small seller listing directly to shoppers.',
  },
  {
    value: 'B2B',
    icon: 'sellers',
    title: 'B2B partner',
    blurb: 'Registered business — company details and a contact person required.',
  },
]

const BUSINESS_TYPE_OPTIONS = [
  { value: 'proprietorship', label: 'Proprietorship' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'llp', label: 'LLP' },
  { value: 'private_limited', label: 'Private limited' },
  { value: 'public_limited', label: 'Public limited' },
  { value: 'huf', label: 'HUF' },
  { value: 'society_trust', label: 'Society / Trust' },
  { value: 'other', label: 'Other' },
]

export function VendorFormDrawer({ isOpen, ...props }) {
  if (!isOpen) return null
  return <VendorFormDrawerBody {...props} />
}

function Section({ title, description, children }) {
  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs">
      <p className="text-2xs font-bold uppercase tracking-wider text-slate-400">{title}</p>
      {description && <p className="mt-0.5 text-2xs text-slate-500">{description}</p>}
      <div className="mt-3.5 flex flex-col gap-3.5">{children}</div>
    </div>
  )
}

function VendorFormDrawerBody({ onClose, onSubmit, isSubmitting, error }) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    defaultValues: {
      vendorType: 'B2C',
      name: '',
      email: '',
      mobile: '',
      password: '',
      gstRegistered: false,
      approveNow: true,
      business: { businessName: '', businessType: 'proprietorship', gstin: '', pan: '' },
      contactPerson: { name: '', mobile: '' },
      address: { addressLine: '', city: '', state: '', pincode: '' },
    },
  })

  const vendorType = watch('vendorType')
  const gstRegistered = watch('gstRegistered')
  const isB2B = vendorType === 'B2B'

  function submit(values) {
    onSubmit({
      vendorType: values.vendorType,
      name: values.name.trim(),
      email: values.email.trim(),
      mobile: values.mobile.trim(),
      password: values.password,
      gstRegistered: values.gstRegistered,
      approveNow: values.approveNow,
      business: isB2B
        ? values.business
        : { gstin: values.gstRegistered ? values.business.gstin : '', pan: values.business.pan },
      contactPerson: isB2B ? values.contactPerson : {},
      address: values.address,
    })
  }

  return (
    <FormDrawer
      isOpen
      onClose={onClose}
      title="Onboard partner"
      description="One step: pick the partner type, fill in the details, and the account is created."
      submitLabel={isSubmitting ? 'Registering…' : 'Register partner'}
      isSubmitting={isSubmitting}
      error={error}
      onSubmit={handleSubmit(submit)}
      width="lg"
    >
      <div className="grid grid-cols-2 gap-3">
        {PARTNER_TYPES.map((type) => {
          const isSelected = vendorType === type.value
          return (
            <button
              key={type.value}
              type="button"
              onClick={() => setValue('vendorType', type.value)}
              className={`flex flex-col gap-1.5 rounded-2xl border p-4 text-left transition-all ${
                isSelected
                  ? 'border-brand-600 bg-brand-50/60 ring-2 ring-brand-500/20'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <span className="flex items-center gap-2">
                <Icon
                  name={type.icon}
                  className={`h-4 w-4 ${isSelected ? 'text-brand-600' : 'text-slate-400'}`}
                />
                <span className={`text-sm font-bold ${isSelected ? 'text-brand-700' : 'text-slate-900'}`}>
                  {type.title}
                </span>
              </span>
              <span className="text-2xs leading-snug text-slate-500">{type.blurb}</span>
            </button>
          )
        })}
      </div>

      <Section title="Account" description="These are the partner's sign-in credentials for the seller portal.">
        <Input
          id="name"
          label={isB2B ? 'Brand / display name' : 'Seller name'}
          required
          placeholder={isB2B ? 'e.g. Nova Retail' : 'e.g. Rohan Mehta'}
          {...register('name', { required: 'Name is required' })}
          error={errors.name?.message}
        />
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Input
            id="email"
            label="Email"
            type="email"
            required
            placeholder="partner@company.com"
            {...register('email', {
              required: 'Email is required',
              pattern: { value: /^\S+@\S+\.\S+$/, message: 'Enter a valid email' },
            })}
            error={errors.email?.message}
          />
          <Input
            id="mobile"
            label="Mobile"
            type="tel"
            required
            placeholder="9876543210"
            {...register('mobile', {
              required: 'Mobile is required',
              pattern: { value: /^[0-9]{10}$/, message: 'Enter a valid 10-digit mobile' },
            })}
            error={errors.mobile?.message}
          />
        </div>
        <Input
          id="password"
          label="Temporary password"
          type="text"
          required
          description="Share this with the partner — they sign in to the seller portal with it."
          {...register('password', {
            required: 'Password is required',
            minLength: { value: 6, message: 'At least 6 characters' },
          })}
          error={errors.password?.message}
        />
      </Section>

      {isB2B && (
        <Section title="Business" description="Required for a B2B partner.">
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Input
              id="business.businessName"
              label="Registered business name"
              required
              placeholder="e.g. Nova Retail Pvt Ltd"
              {...register('business.businessName', {
                required: isB2B ? 'Business name is required' : false,
              })}
              error={errors.business?.businessName?.message}
            />
            <Select
              id="business.businessType"
              label="Business type"
              required
              options={BUSINESS_TYPE_OPTIONS}
              {...register('business.businessType', {
                required: isB2B ? 'Business type is required' : false,
              })}
              error={errors.business?.businessType?.message}
            />
          </div>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Input
              id="contactPerson.name"
              label="Authorised contact person"
              required
              placeholder="e.g. Rohan Mehta"
              {...register('contactPerson.name', {
                required: isB2B ? 'Contact person is required' : false,
              })}
              error={errors.contactPerson?.name?.message}
            />
            <Input
              id="contactPerson.mobile"
              label="Contact mobile"
              type="tel"
              required
              placeholder="9876543210"
              {...register('contactPerson.mobile', {
                required: isB2B ? 'Contact mobile is required' : false,
              })}
              error={errors.contactPerson?.mobile?.message}
            />
          </div>
        </Section>
      )}

      <Section title="Tax">
        <label className="flex items-start gap-3 rounded-xl border border-slate-200/90 bg-slate-50/60 p-3.5 cursor-pointer hover:bg-slate-50 transition-colors">
          <input
            type="checkbox"
            {...register('gstRegistered')}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          />
          <span>
            <span className="block text-xs font-semibold text-slate-900">GST registered</span>
            <span className="block text-2xs text-slate-500">
              Tick this if the partner trades under a GSTIN — it becomes mandatory below.
            </span>
          </span>
        </label>

        <div className="grid gap-3.5 sm:grid-cols-2">
          <Input
            id="business.gstin"
            label="GSTIN"
            required={gstRegistered}
            placeholder="27AAFCN9612R1ZQ"
            {...register('business.gstin', {
              required: gstRegistered ? 'GSTIN is required when GST registered' : false,
              setValueAs: (value) => (value || '').toUpperCase().trim(),
            })}
            error={errors.business?.gstin?.message}
          />
          <Input
            id="business.pan"
            label="PAN"
            placeholder="AAFCN9612R"
            {...register('business.pan', { setValueAs: (value) => (value || '').toUpperCase().trim() })}
          />
        </div>
      </Section>

      <Section title="Pickup address">
        <Input id="address.addressLine" label="Address" placeholder="Street, area" {...register('address.addressLine')} />
        <div className="grid gap-3.5 sm:grid-cols-3">
          <Input id="address.city" label="City" placeholder="Mumbai" {...register('address.city')} />
          <Input id="address.state" label="State" placeholder="Maharashtra" {...register('address.state')} />
          <Input id="address.pincode" label="Pincode" placeholder="400072" {...register('address.pincode')} />
        </div>
      </Section>

      <label className="flex items-start gap-3 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs cursor-pointer hover:bg-slate-50 transition-colors">
        <input
          type="checkbox"
          {...register('approveNow')}
          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
        />
        <span>
          <span className="block text-xs font-semibold text-slate-900">Approve and activate now</span>
          <span className="block text-2xs text-slate-500">
            Skips the KYC queue and lets the partner list products straight away. Leave it off to
            register them as pending verification.
          </span>
        </span>
      </label>
    </FormDrawer>
  )
}
