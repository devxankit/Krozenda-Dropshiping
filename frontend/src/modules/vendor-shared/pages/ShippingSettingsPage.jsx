import { useState } from 'react'
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, Input, Modal, Skeleton } from '../../../components/ui'
import { PageBody } from '../../admin/components/shell/PageBody'
import { PageHeader } from '../../admin/components/shell/PageHeader'
import { InlineAlert } from '../../admin/components/feedback'
import { FormDrawer } from '../../admin/components/forms/FormDrawer'
import { usePickupLocationsController, useShippingIntegrationController } from '../controllers/useShippingController'
import { pickupStatusPresentation } from '../../../lib/shipping/presentation'
import { toast } from '../../../lib/toast'

// Seller > Shipping > Settings: which carrier account ships this store's
// parcels, and which warehouses they leave from.
//
// The one thing this screen must never do is imply a credential can be read
// back. The password field is write-only — it is sent, verified and forgotten,
// and there is no endpoint that would return it (task §40).

export function ShippingSettingsPage() {
  const account = useShippingIntegrationController()
  const pickups = usePickupLocationsController()
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)

  if (account.isLoading) {
    return (
      <PageBody>
        <PageHeader title="Shipping & Warehouses" description="Courier status and pickup addresses." />
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </PageBody>
    )
  }

  return (
    <PageBody>
      <PageHeader
        title="Shipping & Pickup Addresses"
        description="Shiprocket courier is connected by Admin. Add and manage your pickup warehouses below."
      />

      <ShiprocketStatusCard />

      <PickupLocationsCard
        pickups={pickups}
        onAdd={() => setEditing({})}
        onEdit={(location) => setEditing(location)}
        onDelete={(location) => setDeleting(location)}
      />

      <PickupLocationDrawer
        location={editing}
        onClose={() => setEditing(null)}
        pickups={pickups}
        onDelete={(location) => setDeleting(location)}
      />

      {deleting && (
        <Modal
          isOpen={Boolean(deleting)}
          onClose={() => !isDeleting && setDeleting(null)}
          title="Delete Pickup Address?"
          size="sm"
          footer={
            <div className="flex items-center justify-end gap-2">
              <Button variant="quiet" size="control" onClick={() => setDeleting(null)} disabled={isDeleting}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="control"
                isLoading={isDeleting}
                onClick={async () => {
                  try {
                    setIsDeleting(true)
                    await pickups.removeLocation(deleting.id)
                    toast.success('Pickup Location Deleted', `"${deleting.nickname}" was removed.`)
                    setDeleting(null)
                  } catch (err) {
                    const msg = err?.response?.data?.message || err?.message || 'Could not delete address.'
                    toast.error('Could not delete address', msg)
                  } finally {
                    setIsDeleting(false)
                  }
                }}
              >
                Delete address
              </Button>
            </div>
          }
        >
          <div className="p-5 flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 shrink-0 rounded-full bg-danger-50 text-danger-600 flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-semibold text-slate-900">{deleting.nickname}</h4>
                <p className="text-xs text-ink-subtle mt-0.5">{deleting.addressLine1}, {deleting.city}</p>
              </div>
            </div>
            <p className="text-xs text-ink-muted">
              Are you sure you want to remove this pickup address? It will no longer be used for courier parcel collections.
            </p>
          </div>
        </Modal>
      )}
    </PageBody>
  )
}

function ShiprocketStatusCard() {
  return (
    <Card>
      <CardBody className="p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="font-semibold text-slate-900 text-base">Shiprocket Logistics</h3>
                <Badge tone="success" dot size="sm">
                  Connected
                </Badge>
              </div>
              <p className="text-xs text-ink-subtle mt-0.5">
                Admin Shiprocket account is active. Courier booking, AWB assignment, and live tracking are centrally managed by the platform.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto rounded-lg bg-surface-muted px-3 py-1.5 border border-border text-2xs text-ink-muted">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-medium text-slate-700">Platform Active</span>
          </div>
        </div>
      </CardBody>
    </Card>
  )
}

function PickupLocationsCard({ pickups, onAdd, onEdit, onDelete }) {
  if (pickups.isLoading) return <Skeleton className="h-64 w-full rounded-xl" />

  return (
    <Card>
      <CardHeader
        title="Pickup addresses"
        description="Where couriers collect your parcels. One must be registered before you can ship."
        actions={
          <Button size="control" onClick={onAdd}>
            Add address
          </Button>
        }
      />
      <CardBody>
        {!pickups.registrationSupported && (
          <div className="mb-4">
            <InlineAlert tone="warning" title="Register these in Shiprocket too">
              Automatic registration with the carrier is not available on this build. Add the same address in your
              Shiprocket panel under <strong>Settings → Pickup Addresses</strong>, using the exact nickname shown below.
            </InlineAlert>
          </div>
        )}

        {pickups.registerError && (
          <div className="mb-4">
            <InlineAlert tone="danger" title="The courier did not accept that address">
              {pickups.registerError?.message || 'Check the address and try again.'}
            </InlineAlert>
          </div>
        )}

        {pickups.items.length === 0 ? (
          <EmptyState
            icon="location"
            title="No pickup addresses yet"
            description="Add the address a courier should collect your parcels from."
            action={<Button onClick={onAdd}>Add address</Button>}
          />
        ) : (
          <div className="flex flex-col gap-3">
            {pickups.items.map((location) => {
              const status = pickupStatusPresentation(location.registrationStatus)
              return (
                <div
                  key={location.id}
                  className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">{location.nickname}</span>
                      {location.isDefault && (
                        <Badge tone="brand" size="sm">
                          Default
                        </Badge>
                      )}
                      <Badge tone={status.tone} size="sm" dot>
                        {status.label}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-ink-subtle">
                      {[location.addressLine1, location.addressLine2, location.city, location.state, location.pincode]
                        .filter(Boolean)
                        .join(', ')}
                    </p>
                    <p className="mt-0.5 text-2xs text-ink-faint">
                      {location.contactName} · {location.phone}
                    </p>
                    {location.registrationError && (
                      <div className="mt-2 flex items-start gap-1.5 rounded-lg border border-blue-200 bg-blue-50/70 p-2 text-2xs text-blue-800">
                        <span className="font-semibold shrink-0">Note:</span>
                        <span>{location.registrationError}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {/* Only a REGISTERED address can ship, so retrying a
                        failed registration is the most useful action here. */}
                    {location.registrationStatus !== 'REGISTERED' && (
                      <Button
                        size="control"
                        onClick={() => {
                          pickups
                            .register(location.id)
                            .then(() => toast.success('Registered with Courier', 'Pickup address registered successfully.'))
                            .catch((err) => {
                              const msg = err?.response?.data?.message || err?.message || 'Please check address details.'
                              toast.info('Address Information Required', msg)
                            })
                        }}
                        isLoading={pickups.isRegistering}
                      >
                        Register with courier
                      </Button>
                    )}
                    {!location.isDefault && (
                      <Button
                        variant="quiet"
                        size="control"
                        onClick={() => {
                          pickups
                            .makeDefault(location.id)
                            .then(() => toast.success('Default Pickup Set', 'Primary courier pickup address updated.'))
                            .catch((err) => toast.error('Could not set default', err))
                        }}
                      >
                        Make default
                      </Button>
                    )}
                    <Button variant="quiet" size="control" onClick={() => onEdit(location)}>
                      Edit
                    </Button>
                    <Button
                      variant="dangerOutline"
                      size="control"
                      onClick={() => onDelete?.(location)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardBody>
    </Card>
  )
}

const EMPTY_LOCATION = {
  nickname: '',
  contactName: '',
  phone: '',
  email: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  pincode: '',
}

function PickupLocationDrawer({ location, onClose, pickups, onDelete }) {
  const isOpen = location !== null
  const isEdit = Boolean(location?.id)
  const [form, setForm] = useState(EMPTY_LOCATION)
  const [hydratedFor, setHydratedFor] = useState(null)
  const [failure, setFailure] = useState('')

  // Hydrate when the drawer opens on a different row, without an effect: the
  // row id is the only thing that should reset the form.
  const key = location?.id || (isOpen ? 'new' : null)
  if (isOpen && hydratedFor !== key) {
    setHydratedFor(key)
    setForm(isEdit ? { ...EMPTY_LOCATION, ...location } : EMPTY_LOCATION)
    setFailure('')
  }

  const set = (field) => (e) => setForm((current) => ({ ...current, [field]: e.target.value }))

  const close = () => {
    setHydratedFor(null)
    onClose()
  }

  const submit = async (e) => {
    e?.preventDefault?.()
    setFailure('')
    const body = {
      nickname: form.nickname.trim(),
      contactName: form.contactName.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      addressLine1: form.addressLine1.trim(),
      addressLine2: form.addressLine2.trim(),
      city: form.city.trim(),
      state: form.state.trim(),
      pincode: form.pincode.trim(),
    }
    try {
      if (isEdit) {
        await pickups.editLocation(location.id, body)
        toast.success('Pickup Location Updated', 'Location details were saved.')
      } else {
        await pickups.addLocation(body)
        toast.success('Pickup Location Added', 'New pickup address registered.')
      }
      close()
    } catch (error) {
      const errorMsg = error?.response?.data?.message || error?.message || 'Could not save this address.'
      setFailure(errorMsg)
      if (errorMsg.toLowerCase().includes('character') || errorMsg.toLowerCase().includes('house') || errorMsg.toLowerCase().includes('flat') || errorMsg.toLowerCase().includes('road') || errorMsg.toLowerCase().includes('address')) {
        toast.info('Address Information Required', errorMsg)
      } else {
        toast.error('Could not save address', errorMsg)
      }
    }
  }

  const isAddress1Valid = form.addressLine1.trim().length >= 10
  const canSubmit =
    form.nickname.trim() &&
    form.contactName.trim() &&
    isAddress1Valid &&
    form.city.trim() &&
    form.state.trim() &&
    /^[6-9]\d{9}$/.test(form.phone.replace(/\D/g, '').slice(-10)) &&
    /^\d{6}$/.test(form.pincode.trim())

  return (
    <FormDrawer
      isOpen={isOpen}
      onClose={close}
      title={isEdit ? 'Edit pickup address' : 'Add pickup address'}
      description="This is where couriers collect customer parcels. It is registered directly with Shiprocket."
      submitLabel={isEdit ? 'Save address' : 'Add address'}
      isSubmitting={pickups.isSaving}
      canSubmit={Boolean(canSubmit) && !pickups.isSaving}
      onSubmit={submit}
    >
      <div className="flex flex-col gap-4">
        <Row>
          <LabeledInput label="Nickname" value={form.nickname} onChange={set('nickname')} placeholder="e.g. Main Hub" />
          <LabeledInput label="Contact name" value={form.contactName} onChange={set('contactName')} placeholder="e.g. Rehan Multani" />
        </Row>
        <Row>
          <LabeledInput label="Mobile" value={form.phone} onChange={set('phone')} placeholder="10-digit mobile" inputMode="numeric" />
          <LabeledInput label="Email (optional)" type="email" value={form.email} onChange={set('email')} placeholder="warehouse@example.com" />
        </Row>
        
        <div className="flex flex-col gap-1">
          <LabeledInput
            label="Address line 1"
            value={form.addressLine1}
            onChange={set('addressLine1')}
            placeholder="House/Shop no., Building/Street name (min 10 characters)"
          />
          <div className="flex items-center justify-between text-2xs">
            <span className="text-ink-subtle">Must include House/Flat/Road no. (min 10 characters for Shiprocket)</span>
            <span className={form.addressLine1.trim().length < 10 && form.addressLine1.trim().length > 0 ? 'text-danger-600 font-semibold' : 'text-ink-faint'}>
              {form.addressLine1.trim().length}/10 min
            </span>
          </div>
        </div>

        <LabeledInput label="Address line 2 (optional)" value={form.addressLine2} onChange={set('addressLine2')} placeholder="Apartment, suite, landmark, etc." />
        <Row>
          <LabeledInput label="City" value={form.city} onChange={set('city')} placeholder="e.g. Indore" />
          <LabeledInput label="State" value={form.state} onChange={set('state')} placeholder="e.g. Madhya Pradesh" />
        </Row>
        <LabeledInput label="PIN code" value={form.pincode} onChange={set('pincode')} inputMode="numeric" placeholder="6 digits (e.g. 452009)" />

        {failure && (
          <InlineAlert tone="danger" title="Could not save">
            {failure}
          </InlineAlert>
        )}

        {isEdit && (
          <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
            <span className="text-xs text-ink-subtle">No longer need this pickup address?</span>
            <Button
              type="button"
              variant="dangerOutline"
              size="sm"
              onClick={() => {
                close()
                onDelete?.(location)
              }}
            >
              Delete Address
            </Button>
          </div>
        )}
      </div>
    </FormDrawer>
  )
}

function Row({ children }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
}

function LabeledInput({ label, ...props }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-xs font-medium text-slate-700">{label}</span>
      <Input {...props} />
    </label>
  )
}

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-2xs uppercase tracking-wide text-ink-faint">{label}</dt>
      <dd className="text-sm text-slate-900">{children}</dd>
    </div>
  )
}
