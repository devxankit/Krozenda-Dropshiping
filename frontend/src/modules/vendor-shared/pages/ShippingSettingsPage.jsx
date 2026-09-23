import { useState } from 'react'
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, Input, PasswordInput, Skeleton } from '../../../components/ui'
import { PageBody } from '../../admin/components/shell/PageBody'
import { PageHeader } from '../../admin/components/shell/PageHeader'
import { InlineAlert } from '../../admin/components/feedback'
import { FormDrawer } from '../../admin/components/forms/FormDrawer'
import { usePickupLocationsController, useShippingIntegrationController } from '../controllers/useShippingController'
import { integrationStatusPresentation, pickupStatusPresentation, formatDateTime } from '../../../lib/shipping/presentation'
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
  const [isConnectOpen, setConnectOpen] = useState(false)
  const [editing, setEditing] = useState(null)

  if (account.isLoading) {
    return (
      <PageBody>
        <PageHeader title="Shipping" description="Your courier account and pickup addresses." />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </PageBody>
    )
  }

  return (
    <PageBody>
      <PageHeader
        title="Shipping"
        description="Connect a courier account and tell us where we collect your parcels from."
      />

      <ShippingStatusBanner account={account} />

      <CarrierAccountCard
        account={account}
        onConnect={() => setConnectOpen(true)}
      />

      <PickupLocationsCard
        pickups={pickups}
        onAdd={() => setEditing({})}
        onEdit={(location) => setEditing(location)}
      />

      <ConnectDrawer
        isOpen={isConnectOpen}
        onClose={() => setConnectOpen(false)}
        account={account}
      />

      <PickupLocationDrawer
        location={editing}
        onClose={() => setEditing(null)}
        pickups={pickups}
      />
    </PageBody>
  )
}

// The single sentence that answers "can I ship right now, and on whose
// account?" — which is the only question this page really exists to answer.
function ShippingStatusBanner({ account }) {
  const { effectiveAccount, policy, isUnhealthy } = account

  if (effectiveAccount === 'DISABLED') {
    return (
      <InlineAlert tone="warning" title="Shipping is turned off">
        The marketplace has shipping disabled. You cannot create new shipments until an administrator enables it.
        Existing parcels remain trackable.
      </InlineAlert>
    )
  }

  if (effectiveAccount === 'NONE') {
    return (
      <InlineAlert tone="danger" title="You cannot create shipments yet">
        {policy?.sellerOwnAccountEnabled
          ? 'Connect your own Shiprocket account below. The platform account is not available as a fallback for this marketplace.'
          : 'Seller accounts are turned off and no platform fallback is available. Contact the marketplace administrator.'}
      </InlineAlert>
    )
  }

  if (isUnhealthy) {
    return (
      <InlineAlert tone="danger" title="Your Shiprocket account is not responding">
        The last call to Shiprocket failed. Reconnect below — until then, new shipments will be refused.
      </InlineAlert>
    )
  }

  if (effectiveAccount === 'PLATFORM') {
    return (
      <InlineAlert tone="info" title="Shipping on the platform account">
        Your parcels currently ship on the marketplace&apos;s courier account. Connect your own Shiprocket account
        below to use your own rates and pickup addresses.
      </InlineAlert>
    )
  }

  return (
    <InlineAlert tone="success" title="Shipping on your own Shiprocket account">
      New parcels use your account, your rates and your registered pickup addresses.
    </InlineAlert>
  )
}

function CarrierAccountCard({ account, onConnect }) {
  const { integration, canStoreCredentials, policy, disconnect, isDisconnecting } = account
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false)

  if (!policy?.sellerOwnAccountEnabled) {
    return (
      <Card>
        <CardHeader title="Courier account" description="Managed by the marketplace." />
        <CardBody>
          <p className="text-sm text-ink-subtle">
            This marketplace ships every order on its own Shiprocket account. There is nothing to configure here.
          </p>
        </CardBody>
      </Card>
    )
  }

  if (!canStoreCredentials) {
    return (
      <Card>
        <CardHeader title="Courier account" />
        <CardBody>
          <InlineAlert tone="warning" title="Not available on this server">
            This server is not configured to store courier credentials securely, so your own account cannot be connected
            yet. Ask the marketplace administrator to set this up.
          </InlineAlert>
        </CardBody>
      </Card>
    )
  }

  const presentation = integration ? integrationStatusPresentation(integration.status) : null

  return (
    <Card>
      <CardHeader
        title="Your Shiprocket account"
        description="Used for your rates, your pickup addresses and your invoices."
        actions={
          integration?.isActive ? (
            <div className="flex gap-2">
              <Button variant="quiet" size="control" onClick={onConnect}>
                Reconnect
              </Button>
              <Button
                variant="danger"
                size="control"
                onClick={() => setConfirmingDisconnect(true)}
                isLoading={isDisconnecting}
              >
                Disconnect
              </Button>
            </div>
          ) : (
            <Button size="control" onClick={onConnect}>
              Connect account
            </Button>
          )
        }
      />
      <CardBody>
        {!integration?.isActive ? (
          <p className="text-sm text-ink-subtle">
            No account connected. Until you connect one,{' '}
            {policy.platformFallbackEnabled
              ? "your parcels ship on the marketplace's account."
              : 'you will not be able to create shipments.'}
          </p>
        ) : (
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <Field label="Status">
              <Badge tone={presentation.tone} dot>
                {presentation.label}
              </Badge>
            </Field>
            <Field label="Account">
              <span className="font-mono text-xs">{integration.email || '—'}</span>
            </Field>
            <Field label="Last verified">{formatDateTime(integration.lastSuccessfulAt)}</Field>
            <Field label="Connected on">{formatDateTime(integration.createdAt)}</Field>
            {integration.failureReason && (
              <div className="sm:col-span-2">
                <InlineAlert tone="danger" title="Last failure">
                  {integration.failureReason}
                </InlineAlert>
              </div>
            )}
          </dl>
        )}
      </CardBody>

      <FormDrawer
        isOpen={confirmingDisconnect}
        onClose={() => setConfirmingDisconnect(false)}
        title="Disconnect Shiprocket?"
        submitLabel="Disconnect"
        submitTone="danger"
        isSubmitting={isDisconnecting}
        onSubmit={async () => {
          try {
            await disconnect()
            toast.info('Shiprocket Disconnected', 'Your credentials were removed.')
            setConfirmingDisconnect(false)
          } catch (err) {
            toast.error('Could not disconnect Shiprocket', err)
          }
        }}
      >
        <div className="flex flex-col gap-3 text-sm text-ink-subtle">
          <p>
            Your stored password will be deleted. Parcels already shipped stay trackable on the account that created
            them.
          </p>
          <p>
            {account.policy?.platformFallbackEnabled
              ? "New parcels will ship on the marketplace's account instead."
              : 'You will not be able to create new shipments until you reconnect.'}
          </p>
        </div>
      </FormDrawer>
    </Card>
  )
}

function ConnectDrawer({ isOpen, onClose, account }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [failure, setFailure] = useState('')

  const close = () => {
    // The password never outlives the drawer, even in component state.
    setEmail('')
    setPassword('')
    setFailure('')
    onClose()
  }

  const submit = async () => {
    setFailure('')
    try {
      await account.connect({ email: email.trim(), password })
      toast.success('Shiprocket Connected', 'Your account credentials have been verified.')
      close()
    } catch (error) {
      const msg = error?.message || 'Could not connect that account.'
      setFailure(msg)
      toast.error('Connection Failed', error)
      setPassword('')
    }
  }

  return (
    <FormDrawer
      isOpen={isOpen}
      onClose={close}
      title="Connect your Shiprocket account"
      description="We verify the credentials with Shiprocket before saving them."
      submitLabel="Verify and connect"
      isSubmitting={account.isConnecting}
      canSubmit={email.trim().length > 0 && password.length > 0 && !account.isConnecting}
      onSubmit={submit}
    >
      <div className="flex flex-col gap-4">
        <InlineAlert tone="info" title="Use an API user, not your panel login">
          In Shiprocket, go to <strong>Settings → API → Configure</strong> and create an API user. Those are the
          credentials to enter here.
        </InlineAlert>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-slate-700">Shiprocket email</span>
          <Input
            type="email"
            value={email}
            autoComplete="off"
            placeholder="api-user@yourstore.com"
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-slate-700">Shiprocket password</span>
          <PasswordInput value={password} autoComplete="new-password" onChange={(e) => setPassword(e.target.value)} />
          <span className="text-2xs text-ink-faint">
            Stored encrypted. It is never shown again, and never sent back to this screen.
          </span>
        </label>

        {failure && (
          <InlineAlert tone="danger" title="Could not connect">
            {failure}
          </InlineAlert>
        )}
      </div>
    </FormDrawer>
  )
}

function PickupLocationsCard({ pickups, onAdd, onEdit }) {
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
                      <p className="mt-1 text-2xs text-danger-600">{location.registrationError}</p>
                    )}
                  </div>

                  <div className="flex shrink-0 gap-2">
                    {/* Only a REGISTERED address can ship, so retrying a
                        failed registration is the most useful action here. */}
                    {location.registrationStatus !== 'REGISTERED' && (
                      <Button
                        size="control"
                        onClick={() => {
                          pickups
                            .register(location.id)
                            .then(() => toast.success('Registered with Courier', 'Pickup address registered successfully.'))
                            .catch((err) => toast.error('Registration Failed', err))
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

function PickupLocationDrawer({ location, onClose, pickups }) {
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

  const submit = async () => {
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
      setFailure(error?.message || 'Could not save this address.')
      toast.error('Could not save address', error)
    }
  }

  const canSubmit =
    form.nickname.trim() &&
    form.contactName.trim() &&
    form.addressLine1.trim() &&
    form.city.trim() &&
    form.state.trim() &&
    /^[6-9]\d{9}$/.test(form.phone.replace(/\D/g, '').slice(-10)) &&
    /^\d{6}$/.test(form.pincode.trim())

  return (
    <FormDrawer
      isOpen={isOpen}
      onClose={close}
      title={isEdit ? 'Edit pickup address' : 'Add pickup address'}
      description="This is where the courier collects. It must match what Shiprocket has on file."
      submitLabel={isEdit ? 'Save address' : 'Add address'}
      isSubmitting={pickups.isSaving}
      canSubmit={Boolean(canSubmit) && !pickups.isSaving}
      onSubmit={submit}
    >
      <div className="flex flex-col gap-4">
        <Row>
          <LabeledInput label="Nickname" value={form.nickname} onChange={set('nickname')} placeholder="Indore warehouse" />
          <LabeledInput label="Contact name" value={form.contactName} onChange={set('contactName')} />
        </Row>
        <Row>
          <LabeledInput label="Mobile" value={form.phone} onChange={set('phone')} placeholder="10 digits" inputMode="numeric" />
          <LabeledInput label="Email (optional)" type="email" value={form.email} onChange={set('email')} />
        </Row>
        <LabeledInput label="Address line 1" value={form.addressLine1} onChange={set('addressLine1')} />
        <LabeledInput label="Address line 2 (optional)" value={form.addressLine2} onChange={set('addressLine2')} />
        <Row>
          <LabeledInput label="City" value={form.city} onChange={set('city')} />
          <LabeledInput label="State" value={form.state} onChange={set('state')} />
        </Row>
        <LabeledInput label="PIN code" value={form.pincode} onChange={set('pincode')} inputMode="numeric" placeholder="6 digits" />

        {failure && (
          <InlineAlert tone="danger" title="Could not save">
            {failure}
          </InlineAlert>
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
