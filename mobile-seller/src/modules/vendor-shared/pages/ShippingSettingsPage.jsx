import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, Input, Modal, Skeleton, Text } from '../../../components/ui'
import { PageBody, PageHeader } from '../../../components/admin/shell'
import { InlineAlert } from '../../../components/admin/feedback'
import { FormDrawer } from '../../../components/admin/forms/FormDrawer'
import { usePickupLocationsController, useShippingIntegrationController } from '../controllers/useShippingController'
import { pickupStatusPresentation } from '../../../lib/shipping/presentation'
import { toast } from '../../../lib/toast'
import { colors, radius } from '../../../theme'

// Seller > Shipping > Settings: which carrier account ships this store's
// parcels, and which warehouses they leave from.
//
// The password field of the old per-seller account form no longer exists on
// the web page, so nothing here can imply a credential can be read back.

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
        <Skeleton style={{ height: 112, width: '100%', borderRadius: radius.xl }} />
        <Skeleton style={{ height: 256, width: '100%', borderRadius: radius.xl }} />
      </PageBody>
    )
  }

  return (
    <>
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
      </PageBody>

      <PickupLocationDrawer
        location={editing}
        onClose={() => setEditing(null)}
        pickups={pickups}
        onDelete={(location) => setDeleting(location)}
      />

      {deleting ? (
        <Modal
          isOpen={Boolean(deleting)}
          onClose={() => !isDeleting && setDeleting(null)}
          title="Delete Pickup Address?"
          footer={
            <>
              <Button variant="quiet" size="control" onPress={() => setDeleting(null)} disabled={isDeleting}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="control"
                isLoading={isDeleting}
                onPress={async () => {
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
            </>
          }
        >
          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              <View style={styles.trashTile}>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.danger[600]}>
                  <Path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </Svg>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text noTranslate style={{ fontSize: 14, lineHeight: 20, fontWeight: '600', color: colors.slate[900] }}>
                  {deleting.nickname}
                </Text>
                <Text noTranslate style={{ marginTop: 2, fontSize: 12, lineHeight: 16, color: colors.ink.subtle }}>
                  {deleting.addressLine1}, {deleting.city}
                </Text>
              </View>
            </View>
            <Text style={{ fontSize: 12, lineHeight: 16, color: colors.ink.muted }}>
              Are you sure you want to remove this pickup address? It will no longer be used for courier parcel collections.
            </Text>
          </View>
        </Modal>
      ) : null}
    </>
  )
}

function ShiprocketStatusCard() {
  return (
    <Card>
      <CardBody style={{ padding: 16, gap: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={styles.boltTile}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={colors.success[600]}>
              <Path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </Svg>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
              <Text style={{ fontSize: 16, lineHeight: 24, fontWeight: '600', color: colors.slate[900] }}>Shiprocket Logistics</Text>
              <Badge tone="success" dot size="sm">
                Connected
              </Badge>
            </View>
            <Text style={{ marginTop: 2, fontSize: 12, lineHeight: 16, color: colors.ink.subtle }}>
              Admin Shiprocket account is active. Courier booking, AWB assignment, and live tracking are centrally managed by the platform.
            </Text>
          </View>
        </View>

        <View style={styles.activePill}>
          <View style={{ height: 8, width: 8, borderRadius: 4, backgroundColor: colors.success[500] }} />
          <Text style={{ fontSize: 11, lineHeight: 16, fontWeight: '500', color: colors.slate[700] }}>Platform Active</Text>
        </View>
      </CardBody>
    </Card>
  )
}

function PickupLocationsCard({ pickups, onAdd, onEdit, onDelete }) {
  if (pickups.isLoading) return <Skeleton style={{ height: 256, width: '100%', borderRadius: radius.xl }} />

  return (
    <Card>
      <CardHeader
        title="Pickup addresses"
        description="Where couriers collect your parcels. One must be registered before you can ship."
        actions={
          <Button size="control" onPress={onAdd}>
            Add address
          </Button>
        }
      />
      <CardBody>
        {!pickups.registrationSupported ? (
          <View style={{ marginBottom: 16 }}>
            <InlineAlert tone="warning" title="Register these in Shiprocket too">
              <Text style={{ fontSize: 12, lineHeight: 16, color: colors.warning[700] }}>
                {'Automatic registration with the carrier is not available on this build. Add the same address in your Shiprocket panel under '}
                <Text style={{ fontSize: 12, lineHeight: 16, fontWeight: '700', color: colors.warning[700] }}>Settings → Pickup Addresses</Text>
                {', using the exact nickname shown below.'}
              </Text>
            </InlineAlert>
          </View>
        ) : null}

        {pickups.registerError ? (
          <View style={{ marginBottom: 16 }}>
            <InlineAlert tone="danger" title="The courier did not accept that address">
              {pickups.registerError?.message || 'Check the address and try again.'}
            </InlineAlert>
          </View>
        ) : null}

        {pickups.items.length === 0 ? (
          <EmptyState
            icon="location"
            title="No pickup addresses yet"
            description="Add the address a courier should collect your parcels from."
            action={<Button onPress={onAdd}>Add address</Button>}
          />
        ) : (
          <View style={{ gap: 12 }}>
            {pickups.items.map((location) => {
              const status = pickupStatusPresentation(location.registrationStatus)
              return (
                <View key={location.id} style={styles.locationCard}>
                  <View style={{ minWidth: 0 }}>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                      <Text noTranslate style={{ fontSize: 14, lineHeight: 20, fontWeight: '600', color: colors.slate[900] }}>
                        {location.nickname}
                      </Text>
                      {location.isDefault ? (
                        <Badge tone="brand" size="sm">
                          Default
                        </Badge>
                      ) : null}
                      <Badge tone={status.tone} size="sm" dot>
                        {status.label}
                      </Badge>
                    </View>
                    <Text noTranslate style={{ marginTop: 4, fontSize: 12, lineHeight: 16, color: colors.ink.subtle }}>
                      {[location.addressLine1, location.addressLine2, location.city, location.state, location.pincode]
                        .filter(Boolean)
                        .join(', ')}
                    </Text>
                    <Text noTranslate style={{ marginTop: 2, fontSize: 11, lineHeight: 16, color: colors.ink.faint }}>
                      {location.contactName} · {location.phone}
                    </Text>
                    {location.registrationError ? (
                      <View style={styles.noteBox}>
                        <Text style={{ fontSize: 11, lineHeight: 16, fontWeight: '600', color: colors.brand[800] }}>Note:</Text>
                        <Text style={{ flex: 1, fontSize: 11, lineHeight: 16, color: colors.brand[800] }}>{location.registrationError}</Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                    {/* Only a REGISTERED address can ship, so retrying a
                        failed registration is the most useful action here. */}
                    {location.registrationStatus !== 'REGISTERED' ? (
                      <Button
                        size="control"
                        onPress={() => {
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
                    ) : null}
                    {!location.isDefault ? (
                      <Button
                        variant="quiet"
                        size="control"
                        onPress={() => {
                          pickups
                            .makeDefault(location.id)
                            .then(() => toast.success('Default Pickup Set', 'Primary courier pickup address updated.'))
                            .catch((err) => toast.error('Could not set default', err))
                        }}
                      >
                        Make default
                      </Button>
                    ) : null}
                    <Button variant="quiet" size="control" onPress={() => onEdit(location)}>
                      Edit
                    </Button>
                    <Button variant="dangerOutline" size="control" onPress={() => onDelete?.(location)}>
                      Delete
                    </Button>
                  </View>
                </View>
              )
            })}
          </View>
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

  const addr1Len = form.addressLine1.trim().length

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
      <View style={{ gap: 16 }}>
        <Input label="Nickname" value={form.nickname} onChange={set('nickname')} placeholder="e.g. Main Hub" />
        <Input label="Contact name" value={form.contactName} onChange={set('contactName')} placeholder="e.g. Rehan Multani" />
        <Input label="Mobile" type="tel" value={form.phone} onChange={set('phone')} placeholder="10-digit mobile" keyboardType="number-pad" />
        <Input label="Email (optional)" type="email" value={form.email} onChange={set('email')} placeholder="warehouse@example.com" />

        <View style={{ gap: 4 }}>
          <Input
            label="Address line 1"
            value={form.addressLine1}
            onChange={set('addressLine1')}
            placeholder="House/Shop no., Building/Street name (min 10 characters)"
          />
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            <Text style={{ flex: 1, fontSize: 11, lineHeight: 16, color: colors.ink.subtle }}>
              Must include House/Flat/Road no. (min 10 characters for Shiprocket)
            </Text>
            <Text
              noTranslate
              style={{
                fontSize: 11,
                lineHeight: 16,
                fontWeight: addr1Len < 10 && addr1Len > 0 ? '600' : '400',
                color: addr1Len < 10 && addr1Len > 0 ? colors.danger[600] : colors.ink.faint,
              }}
            >
              {addr1Len}/10 min
            </Text>
          </View>
        </View>

        <Input label="Address line 2 (optional)" value={form.addressLine2} onChange={set('addressLine2')} placeholder="Apartment, suite, landmark, etc." />
        <Input label="City" value={form.city} onChange={set('city')} placeholder="e.g. Indore" />
        <Input label="State" value={form.state} onChange={set('state')} placeholder="e.g. Madhya Pradesh" />
        <Input label="PIN code" value={form.pincode} onChange={set('pincode')} keyboardType="number-pad" maxLength={6} placeholder="6 digits (e.g. 452009)" />

        {failure ? (
          <InlineAlert tone="danger" title="Could not save">
            {failure}
          </InlineAlert>
        ) : null}

        {isEdit ? (
          <View style={styles.deleteRow}>
            <Text style={{ flex: 1, fontSize: 12, lineHeight: 16, color: colors.ink.subtle }}>
              No longer need this pickup address?
            </Text>
            <Button
              variant="dangerOutline"
              size="sm"
              onPress={() => {
                close()
                onDelete?.(location)
              }}
            >
              Delete Address
            </Button>
          </View>
        ) : null}
      </View>
    </FormDrawer>
  )
}

const styles = StyleSheet.create({
  boltTile: {
    height: 44,
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.2)',
    backgroundColor: 'rgba(34,197,94,0.1)',
  },
  trashTile: {
    height: 40,
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: colors.danger[50],
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.DEFAULT,
    backgroundColor: colors.surface.muted,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  locationCard: {
    gap: 8,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border.DEFAULT,
    backgroundColor: colors.surface.DEFAULT,
    padding: 16,
  },
  noteBox: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.brand[200],
    backgroundColor: 'rgba(239,246,255,0.7)',
    padding: 8,
  },
  deleteRow: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border.DEFAULT,
    paddingTop: 16,
  },
})
